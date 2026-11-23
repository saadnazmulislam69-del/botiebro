import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import pino from "pino";
import sharp from "sharp";
import http from "http";

http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is running");
  })
  .listen(process.env.PORT || 3000);

const PHONE = process.env.PHONE_NUMBER;
const TIMEZONE = "Asia/Dhaka"; // change this to your timezone if needed

// ---------- Edit these ----------
const rules = [
  "1. Be respectful to everyone.",
  "2. No spam or ads.",
  "3. Keep it friendly.",
];
// --------------------------------

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const jokes = [
  "Why don't programmers like nature? Too many bugs.",
  "I told my computer I needed a break. Now it won't stop sending me vacation ads.",
  "Why did the phone wear glasses? It lost its contacts.",
  "I would tell you a UDP joke, but you might not get it.",
];

const quotes = [
  "The best way to get started is to quit talking and begin doing.",
  "Don't watch the clock; do what it does. Keep going.",
  "It always seems impossible until it's done.",
  "Small steps every day add up to big results.",
  "Fall seven times, stand up eight.",
];

const eightBall = [
  "Yes, definitely.",
  "It is certain.",
  "Most likely.",
  "Ask again later.",
  "I can't predict that right now.",
  "Don't count on it.",
  "My answer is no.",
  "Very doubtful.",
];

const trivia = [
  { q: "What is the capital of Japan?", a: "tokyo" },
  { q: "How many continents are there?", a: "7" },
  { q: "What planet is known as the Red Planet?", a: "mars" },
  { q: "What is the largest ocean on Earth?", a: "pacific" },
  { q: "How many days are in a leap year?", a: "366" },
  { q: "What gas do plants absorb from the air?", a: "carbon dioxide" },
];

const helpText = `*Bot commands*

*Fun*
/dice - roll a die
/flip - flip a coin
/8ball <question> - magic 8-ball
/quote - random quote
/rps <rock|paper|scissors> - play against the bot
/joke - random joke

*Games*
/guess - start a number game (1-100)
/guess <number> - make a guess
/trivia - get a question
/answer <text> - answer the trivia question

*Group*
/tagall - mention everyone
/groupinfo - group details
/admins - list admins
/rules - group rules
*AI*
/gemma <question>
/ling <question>
/inkling <question>
/nemotron <question>
/ai <question> - tries several free models
*Party*
/wyr - would you rather
/truth - truth question
/dare - dare
/tictactoe - play against the bot (then /move <1-9>)
/roast @person - friendly roast
/compliment @person - nice compliment
/ship @a @b - love meter
/poll Question | option 1 | option 2

*Tools*
/weather <city>
/translate <language> <text>
*Flags*
/flag - start a flag round
/fa <country> - answer
/flagskip - reveal and skip
/flagscore - leaderboard
*Coins & games*
/balance - your coins (or /balance @person)
/daily - free daily coins
/rank - richest players
/give @person <amount> - send coins
/coinbet <amount> <heads|tails>
/slots <amount>
/dicebet <amount> <1-6>

*Group tools*
/count - message leaderboard
/kick @person - admins only
/groupadminonly on|off - admins only
/botadminonly on|off - bot admin only
/admin - bot admin info
*Voice & people*
/say <code> <text> - bot speaks (e.g. /say bn ...)
/saytr <code> <text> - translate, then speak
/saylangs - language codes
/pfp @person - profile picture
/add <number> - add to group (admins)
*Other*
/time - current time
/music <song> - search links for a song
/ping - check the bot is alive
/hello - say hello`;
async function askAI(model, keyName, question) {
  const key = process.env[keyName];
  if (!key) return "This AI isn't set up yet.";
  const fullKey = key.startsWith("sk-or-v1-") ? key : "sk-or-v1-" + key;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fullKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(Array.isArray(model) ? { models: model } : { model }),
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful WhatsApp bot. Keep answers short and plain, with no tables.",
        },
        { role: "user", content: question },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  const out = data.choices?.[0]?.message?.content?.trim();
  return out ? out.slice(0, 3500) : "The AI sent an empty answer. Try again.";
}
const AI_MODELS = [
  "baidu/ernie-5.5-flash-preview:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "openrouter/free",
];

const wyrList = [
  "Would you rather always be 10 minutes late or always be 20 minutes early?",
  "Would you rather have unlimited free food or unlimited free travel?",
  "Would you rather be able to fly or be invisible?",
  "Would you rather speak every language or play every instrument?",
  "Would you rather live without music or without movies?",
  "Would you rather have a rewind button or a pause button for your life?",
  "Would you rather be famous but broke or rich but unknown?",
  "Would you rather never use social media again or never watch videos again?",
];

const truthList = [
  "What's the most embarrassing thing you've done in public?",
  "What's a food you secretly hate that everyone else loves?",
  "What's the last lie you told?",
  "What's your most unpopular opinion?",
  "What's the silliest thing you're afraid of?",
  "What's the worst gift you've ever received?",
  "What song do you secretly love but never admit to?",
];

const dareList = [
  "Send a voice note singing the first song that comes to mind.",
  "Describe your whole day using only emojis.",
  "Type with your eyes closed and send whatever comes out.",
  "Speak in rhymes for your next 5 messages.",
  "Send a voice note saying a tongue twister three times fast.",
  "Share your most-used emoji and explain why.",
  "Compliment everyone who sent a message in the last 10 minutes.",
];

const tttGames = new Map();
const tttLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const tttWinner = (b) => {
  for (const [a, c, d] of tttLines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
};
const tttShow = (b) => {
  const nums = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
  const cell = (i) => (b[i] === "X" ? "❌" : b[i] === "O" ? "⭕" : nums[i]);
  return [0, 3, 6].map((r) => cell(r) + cell(r + 1) + cell(r + 2)).join("\n");
};
const tttBotMove = (b) => {
  const free = b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
  for (const mark of ["O", "X"]) {
    for (const i of free) {
      const t = [...b];
      t[i] = mark;
      if (tttWinner(t)) return i;
    }
  }
  if (free.includes(4)) return 4;
  return pick(free);
};
const flagCountries = [
  ["BD", "Bangladesh"], ["IN", "India"], ["PK", "Pakistan"],
  ["LK", "Sri Lanka"], ["NP", "Nepal"], ["BT", "Bhutan"],
  ["MV", "Maldives"], ["AF", "Afghanistan"], ["CN", "China"],
  ["JP", "Japan"], ["KR", "South Korea", "Korea"], ["KP", "North Korea"],
  ["TH", "Thailand"], ["VN", "Vietnam"], ["ID", "Indonesia"],
  ["MY", "Malaysia"], ["SG", "Singapore"], ["PH", "Philippines"],
  ["MM", "Myanmar", "Burma"], ["SA", "Saudi Arabia"],
  ["AE", "United Arab Emirates", "UAE"], ["QA", "Qatar"],
  ["KW", "Kuwait"], ["TR", "Turkey", "Turkiye"], ["IR", "Iran"],
  ["IQ", "Iraq"], ["EG", "Egypt"], ["ZA", "South Africa"],
  ["NG", "Nigeria"], ["KE", "Kenya"], ["ET", "Ethiopia"],
  ["GH", "Ghana"], ["MA", "Morocco"], ["DZ", "Algeria"],
  ["GB", "United Kingdom", "UK", "Britain", "Great Britain", "England"],
  ["FR", "France"], ["DE", "Germany"], ["IT", "Italy"],
  ["ES", "Spain"], ["PT", "Portugal"], ["NL", "Netherlands", "Holland"],
  ["BE", "Belgium"], ["CH", "Switzerland"], ["SE", "Sweden"],
  ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"],
  ["PL", "Poland"], ["GR", "Greece"], ["RU", "Russia"],
  ["UA", "Ukraine"], ["IE", "Ireland"], ["AT", "Austria"],
  ["US", "United States", "USA", "America", "United States of America"],
  ["CA", "Canada"], ["MX", "Mexico"], ["BR", "Brazil"],
  ["AR", "Argentina"], ["CL", "Chile"], ["CO", "Colombia"],
  ["PE", "Peru"], ["CU", "Cuba"], ["AU", "Australia"],
  ["NZ", "New Zealand"],
];

const flagGames = new Map();
const flagScores = new Map();

const flagNorm = (s) =>
  s.toLowerCase().replace(/[^a-z]/g, "").replace(/^the/, "");

const flagEmoji = (code) =>
  String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
  );

const flagNext = (jid) => {
  const c = pick(flagCountries);
  flagGames.set(jid, c);
  return `${flagEmoji(c[0])}\nWhich country is this flag?\nAnswer with /fa <country>`;
};
const OWNER_INFO = `*Bot admin*
👤 Nazmul Islam Saad
📸 Instagram: https://www.instagram.com/nazmulislamsaad?fqnt=MXBrNXZ0bnJ3ZDhqNQ==
📘 Facebook: https://www.facebook.com/profile.php?id=61596590280561`;

const OWNERS = (process.env.OWNER_NUMBER || "")
  .split(",")
  .map((s) => s.replace(/\D/g, ""))
  .filter(Boolean);

const num = (id) => (id || "").split("@")[0].split(":")[0];
const senderJid = (msg) => msg.key.participant || msg.key.remoteJid;
const fmt = (n) => n.toLocaleString("en-US");

const isOwner = (msg) =>
  [
    msg.key.participant,
    msg.key.participantAlt,
    msg.key.remoteJid,
    msg.key.remoteJidAlt,
  ]
    .filter(Boolean)
    .map(num)
    .some((n) => OWNERS.includes(n));

const idsOf = (p) => [p.id, p.lid, p.phoneNumber].filter(Boolean).map(num);

const isGroupAdmin = async (sock, jid, msg) => {
  const meta = await sock.groupMetadata(jid);
  const mine = [msg.key.participant, msg.key.participantAlt]
    .filter(Boolean)
    .map(num);
  return meta.participants.some(
    (p) => p.admin && idsOf(p).some((n) => mine.includes(n))
  );
};

let botAdminOnly = false;
const groupAdminOnly = new Set();

const msgCounts = new Map();
const countMessage = (jid, msg) => {
  if (msg.message.protocolMessage) return;
  const who = msg.key.participant;
  if (!who) return;
  if (!msgCounts.has(jid)) msgCounts.set(jid, new Map());
  const g = msgCounts.get(jid);
  const e = g.get(num(who)) || { jid: who, n: 0 };
  e.jid = who;
  e.n += 1;
  g.set(num(who), e);
};

const START_COINS = 1000;
const DAILY_COINS = 500;
const wallets = new Map();
const wallet = (jid) => {
  const k = num(jid);
  if (!wallets.has(k)) wallets.set(k, { jid, coins: START_COINS, last: 0 });
  const w = wallets.get(k);
  w.jid = jid;
  return w;
};

const parseBet = (arg, w) => {
  if (!arg) return { err: "Enter a bet amount, e.g. 100 (or 'all')." };
  const bet = arg.toLowerCase() === "all" ? w.coins : parseInt(arg, 10);
  if (!Number.isInteger(bet) || bet < 1)
    return { err: "Bet must be a whole number of at least 1. Try /daily for free coins." };
  if (bet > w.coins) return { err: `You only have ${fmt(w.coins)} 🪙.` };
  return { bet };
};

const slotSymbols = ["🍒", "🍋", "🍉", "⭐", "💎", "7️⃣"];
const TTS_LANGS = {
  en: "English", bn: "Bengali", hi: "Hindi", ur: "Urdu", ar: "Arabic",
  ne: "Nepali", ta: "Tamil", te: "Telugu", ml: "Malayalam", mr: "Marathi",
  gu: "Gujarati", si: "Sinhala", id: "Indonesian", ms: "Malay", th: "Thai",
  vi: "Vietnamese", "zh-CN": "Chinese", ja: "Japanese", ko: "Korean",
  tr: "Turkish", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ru: "Russian", nl: "Dutch", pl: "Polish",
  sv: "Swedish", el: "Greek",
};

const ttsLang = (c) =>
  Object.keys(TTS_LANGS).find((k) => k.toLowerCase() === c.toLowerCase());

const ttsGoogle = async (text, lang) => {
  const parts = text.match(/[\s\S]{1,180}(?:\s|$)|[\s\S]{1,180}/g) || [];
  const bufs = [];
  for (const p of parts) {
    if (!p.trim()) continue;
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
      `&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(p.trim())}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    bufs.push(Buffer.from(await res.arrayBuffer()));
  }
  if (!bufs.length) throw new Error("No audio");
  return Buffer.concat(bufs);
};
const guessGames = new Map();
const triviaGames = new Map();

async function handle(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;
  const jid = msg.key.remoteJid;
  const isGroup = jid.endsWith("@g.us");
  const text =
      const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    "";
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const args = parts.slice(1);
  if (isGroup) countMessage(jid, msg);
  if (!cmd.startsWith("/")) return;
  console.log("MSG:", jid, text);

  const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
  if (cmd !== "/botadminonly" && cmd !== "/groupadminonly") {
    const owner = isOwner(msg);
    if (botAdminOnly && !owner)
      return reply("🔒 The bot is in bot-admin-only mode right now.");
    if (
      isGroup &&
      groupAdminOnly.has(jid) &&
      !owner &&
      !(await isGroupAdmin(sock, jid, msg))
    )
      return reply("🔒 Only group admins can use the bot in this group right now.");
  }

  switch (cmd) {
  case "/gemma":
    case "/ling":
    case "/inkling":
    case "/ernie":
    case "/lfm":
    case "/dots":
    case "/nemotron":
    case "/ai": {
      const q = args.join(" ");
      if (!q) return reply(`Usage: ${cmd} <your question>`);
      const cfg = {
        "/gemma": ["google/gemma-4-26b-a4b-it", "GEMMA_KEY"],
        "/ling": ["inclusionai/ling-3.2-flash:free", "LING_KEY"],
        "/inkling": ["thinkingmachines/inkling", "INKLING_KEY"],
        "/ernie": ["baidu/ernie-5.5-flash-preview:free", "LING_KEY"],
        "/lfm": ["liquid/lfm-3-1.7b:free", "LING_KEY"],
        "/dots": ["dots-studio/dots-3-note-preview:free", "LING_KEY"],
        "/nemotron": ["nvidia/nemotron-3-ultra-550b-a55b:free", "LING_KEY"],
        "/ai": [
          [
            "baidu/ernie-5.5-flash-preview:free",
            "nvidia/nemotron-3-ultra-550b-a55b:free",
            "openrouter/free",
          ],
          "LING_KEY",
        ],
      }[cmd];
      try {
        return reply(await askAI(cfg[0], cfg[1], q));
      } catch (e) {
        console.error("AI error:", e.message);
        return reply("AI request failed. Try again later.");
      }
    }  
   case "/wyr":
      return reply(`🤔 ${pick(wyrList)}`);
    case "/truth":
      return reply(`🫣 Truth: ${pick(truthList)}`);
    case "/dare":
      return reply(`😈 Dare: ${pick(dareList)}`);
    case "/tictactoe": {
      const b = Array(9).fill(null);
      tttGames.set(jid, b);
      return reply(`${tttShow(b)}\n\nYou are ❌. Play with /move <1-9>`);
    }
    case "/move": {
      const b = tttGames.get(jid);
      if (!b) return reply("No game running. Start one with /tictactoe");
      const n = parseInt(args[0], 10);
      if (!(n >= 1 && n <= 9) || b[n - 1])
        return reply("Pick a free square from 1 to 9, e.g. /move 5");
      b[n - 1] = "X";
      if (tttWinner(b)) {
        tttGames.delete(jid);
        return reply(`${tttShow(b)}\n\n🎉 You win!`);
      }
      if (b.every(Boolean)) {
        tttGames.delete(jid);
        return reply(`${tttShow(b)}\n\nIt's a draw!`);
      }
      b[tttBotMove(b)] = "O";
      if (tttWinner(b)) {
        tttGames.delete(jid);
        return reply(`${tttShow(b)}\n\n😎 I win!`);
      }
      if (b.every(Boolean)) {
        tttGames.delete(jid);
        return reply(`${tttShow(b)}\n\nIt's a draw!`);
      }
      return reply(`${tttShow(b)}\n\nYour move: /move <1-9>`);
    }
    case "/roast":
    case "/compliment": {
      const who =
        msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const label = who ? `@${who.split("@")[0]}` : args.join(" ");
      if (!label) return reply(`Usage: ${cmd} @person`);
      const prompt =
        cmd === "/roast"
          ? "Write a short, friendly, funny roast (2 sentences) of a friend. Keep it harmless: no jokes about family, looks, religion, race, health or anything hurtful."
          : "Write a short, warm, funny compliment (2 sentences) for a friend.";
      try {
        const out = await askAI(AI_MODELS, "LING_KEY", prompt);
        return sock.sendMessage(
          jid,
          { text: `${label} ${out}`, mentions: who ? [who] : [] },
          { quoted: msg }
        );
      } catch (e) {
        console.error("AI error:", e.message);
        return reply("AI request failed. Try again later.");
      }
    }
    case "/ship": {
      const m =
        msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (m.length < 2) return reply("Usage: /ship @person1 @person2");
      const pct = Math.floor(Math.random() * 101);
      const hearts = Math.round(pct / 10);
      const bar = "❤️".repeat(hearts) + "🖤".repeat(10 - hearts);
      return sock.sendMessage(
        jid,
        {
          text: `💘 @${m[0].split("@")[0]} + @${m[1].split("@")[0]}\n${bar}\nMatch: ${pct}%`,
          mentions: m.slice(0, 2),
        },
        { quoted: msg }
      );
    }
    case "/poll": {
      const items = text
        .slice(cmd.length)
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length < 3 || items.length > 13)
        return reply("Usage: /poll Question | option 1 | option 2");
      return sock.sendMessage(jid, {
        poll: { name: items[0], values: items.slice(1), selectableCount: 1 },
      });
    }
    case "/weather": {
      const city = args.join(" ");
      if (!city) return reply("Usage: /weather <city>");
      try {
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=%l:+%c+%t+(feels+like+%f),+humidity+%h,+wind+%w`;
        const res = await fetch(url, {
          headers: { "User-Agent": "curl/8.0" },
          signal: AbortSignal.timeout(20000),
        });
        const out = (await res.text()).trim();
        if (!res.ok || !out || out.length > 300 || out.startsWith("Unknown"))
          return reply("Couldn't find that place.");
        return reply(`🌤️ ${out}`);
      } catch (e) {
        console.error("Weather error:", e.message);
        return reply("Weather lookup failed. Try again later.");
      }
    }
    case "/translate": {
      const lang = args[0];
      const t = args.slice(1).join(" ");
      if (!lang || !t)
        return reply("Usage: /translate <language> <text>\nExample: /translate bengali how are you");
      try {
        return reply(
          await askAI(
            AI_MODELS,
            "LING_KEY",
            `Translate the text below into ${lang}. Reply with only the translation.\n\n${t}`
          )
        );
      } catch (e) {
        console.error("AI error:", e.message);
        return reply("Translation failed. Try again later.");
      }
    }
    case "/flag":
      return reply(flagNext(jid));
    case "/fa": {
      const g = flagGames.get(jid);
      if (!g) return reply("No flag game running. Start one with /flag");
      if (!args.length) return reply("Write your answer, e.g. /fa japan");
      const given = flagNorm(args.join(" "));
      if (!g.slice(1).map(flagNorm).includes(given))
        return reply("❌ Not quite. Try again, or use /flagskip.");
      const who = msg.key.participant || msg.key.remoteJid;
      const board = flagScores.get(jid) || new Map();
      board.set(who, (board.get(who) || 0) + 1);
      flagScores.set(jid, board);
      flagGames.delete(jid);
      return sock.sendMessage(
        jid,
        {
          text: `✅ @${who.split("@")[0]} got it: ${flagEmoji(g[0])} ${g[1]}!\nPoints: ${board.get(who)}\n\nNext flag: /flag`,
          mentions: [who],
        },
        { quoted: msg }
      );
    }
    case "/flagskip": {
      const g = flagGames.get(jid);
      if (!g) return reply("No flag game running. Start one with /flag");
      return reply(`It was ${flagEmoji(g[0])} ${g[1]}.\n\n${flagNext(jid)}`);
    }
    case "/flagscore": {
      const board = flagScores.get(jid);
      if (!board || !board.size)
        return reply("No points yet. Start with /flag");
      const top = [...board.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const list = top
        .map(([id, n], i) => `${i + 1}. @${id.split("@")[0]} - ${n}`)
        .join("\n");
      return sock.sendMessage(
        jid,
        {
          text: `🏆 *Flag leaderboard*\n${list}`,
          mentions: top.map(([id]) => id),
        },
        { quoted: msg }
      );
    }
    case "/admin":
    case "/owner":
      return reply(OWNER_INFO);
    case "/myid": {
      const ids = [
        msg.key.participant,
        msg.key.participantAlt,
        msg.key.remoteJid,
        msg.key.remoteJidAlt,
      ].filter(Boolean);
      return reply(
        `Your IDs:\n${ids.join("\n")}\nBot admin: ${isOwner(msg) ? "yes" : "no"}`
      );
    }
    case "/count": {
      if (!isGroup) return reply("This only works in groups.");
      const g = msgCounts.get(jid);
      if (!g || !g.size)
        return reply("No messages counted yet. I count from the moment I start.");
      const who = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (who) {
        const e = g.get(num(who));
        return sock.sendMessage(
          jid,
          {
            text: `@${num(who)} has sent ${e ? e.n : 0} messages since I started counting.`,
            mentions: [who],
          },
          { quoted: msg }
        );
      }
      const top = [...g.values()].sort((a, b) => b.n - a.n).slice(0, 10);
      const total = [...g.values()].reduce((s, e) => s + e.n, 0);
      const list = top
        .map((e, i) => `${i + 1}. @${num(e.jid)} - ${e.n}`)
        .join("\n");
      return sock.sendMessage(
        jid,
        {
          text: `📊 *Message count* (total ${total})\n${list}`,
          mentions: top.map((e) => e.jid),
        },
        { quoted: msg }
      );
    }
    case "/kick": {
      if (!isGroup) return reply("This only works in groups.");
      if (!isOwner(msg) && !(await isGroupAdmin(sock, jid, msg)))
        return reply("Only group admins can use /kick.");
      const ctx = msg.message.extendedTextMessage?.contextInfo;
      const target = ctx?.mentionedJid?.[0] || ctx?.participant;
      if (!target)
        return reply("Usage: /kick @person (or reply to their message with /kick)");
      const meta = await sock.groupMetadata(jid);
      const p = meta.participants.find((x) => idsOf(x).includes(num(target)));
      if (!p) return reply("That person isn't in this group.");
      const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean).map(num);
      if (idsOf(p).some((n) => botIds.includes(n)))
        return reply("I can't kick myself 😅");
      if (p.admin)
        return reply("I won't kick an admin. Remove their admin role first.");
      try {
        const res = await sock.groupParticipantsUpdate(jid, [p.id], "remove");
        if (res?.[0]?.status && res[0].status !== "200")
          return reply("I couldn't remove them. Make sure I'm a group admin.");
        return sock.sendMessage(jid, {
          text: `👋 @${num(p.id)} was removed.`,
          mentions: [p.id],
        });
      } catch (e) {
        console.error("Kick error:", e.message);
        return reply("I couldn't remove them. Make sure I'm a group admin.");
      }
    }
    case "/botadminonly": {
      if (!isOwner(msg)) return reply("Only the bot admin can use this.");
      const v = (args[0] || "").toLowerCase();
      if (v !== "on" && v !== "off")
        return reply(
          `Bot-admin-only is ${botAdminOnly ? "ON" : "OFF"}. Use /botadminonly on or off`
        );
      botAdminOnly = v === "on";
      return reply(
        `🔒 Bot-admin-only is now ${botAdminOnly ? "ON: only you can use the bot" : "OFF"}.`
      );
    }
    case "/groupadminonly": {
      if (!isGroup) return reply("This only works in groups.");
      if (!isOwner(msg) && !(await isGroupAdmin(sock, jid, msg)))
        return reply("Only group admins can use this.");
      const v = (args[0] || "").toLowerCase();
      if (v !== "on" && v !== "off")
        return reply(
          `Group-admin-only is ${groupAdminOnly.has(jid) ? "ON" : "OFF"}. Use /groupadminonly on or off`
        );
      if (v === "on") groupAdminOnly.add(jid);
      else groupAdminOnly.delete(jid);
      return reply(
        `🔒 Group-admin-only is now ${v === "on" ? "ON: only group admins can use the bot here" : "OFF"}.`
      );
    }
    case "/balance":
    case "/bal": {
      const target =
        msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        senderJid(msg);
      const w = wallet(target);
      return sock.sendMessage(
        jid,
        { text: `💰 @${num(target)} has ${fmt(w.coins)} 🪙`, mentions: [target] },
        { quoted: msg }
      );
    }
    case "/daily": {
      const w = wallet(senderJid(msg));
      const left = w.last + 24 * 60 * 60 * 1000 - Date.now();
      if (left > 0) {
        const h = Math.floor(left / 3600000);
        const mn = Math.floor((left % 3600000) / 60000);
        return reply(`⏳ Come back in ${h}h ${mn}m for your next daily reward.`);
      }
      w.coins += DAILY_COINS;
      w.last = Date.now();
      return reply(`🎁 You got ${fmt(DAILY_COINS)} 🪙!\nBalance: ${fmt(w.coins)} 🪙`);
    }
    case "/rank":
    case "/top": {
      const top = [...wallets.values()]
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 10);
      if (!top.length) return reply("No players yet. Try /balance or /daily");
      const list = top
        .map((w, i) => `${i + 1}. @${num(w.jid)} - ${fmt(w.coins)} 🪙`)
        .join("\n");
      return sock.sendMessage(
        jid,
        { text: `🏆 *Richest players*\n${list}`, mentions: top.map((w) => w.jid) },
        { quoted: msg }
      );
    }
    case "/give": {
      const to = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const amt = parseInt(args.find((a) => /^\d+$/.test(a)), 10);
      if (!to || !amt || amt < 1) return reply("Usage: /give @person <amount>");
      const from = senderJid(msg);
      if (num(to) === num(from))
        return reply("You can't give coins to yourself.");
      const a = wallet(from);
      if (amt > a.coins) return reply(`You only have ${fmt(a.coins)} 🪙.`);
      a.coins -= amt;
      wallet(to).coins += amt;
      return sock.sendMessage(
        jid,
        {
          text: `🤝 @${num(from)} gave ${fmt(amt)} 🪙 to @${num(to)}`,
          mentions: [from, to],
        },
        { quoted: msg }
      );
    }
    case "/addcoins": {
      if (!isOwner(msg)) return reply("Only the bot admin can use this.");
      const to = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const amt = parseInt(args.find((a) => /^\d+$/.test(a)), 10);
      if (!to || !amt || amt < 1) return reply("Usage: /addcoins @person <amount>");
      const w = wallet(to);
      w.coins += amt;
      return sock.sendMessage(
        jid,
        {
          text: `✅ Added ${fmt(amt)} 🪙 to @${num(to)}. New balance: ${fmt(w.coins)} 🪙`,
          mentions: [to],
        },
        { quoted: msg }
      );
    }
    case "/coinbet": {
      const w = wallet(senderJid(msg));
      const s = (args[1] || "").toLowerCase();
      const side = s.startsWith("h") ? "heads" : s.startsWith("t") ? "tails" : null;
      if (!side) return reply("Usage: /coinbet <amount> <heads|tails>");
      const b = parseBet(args[0], w);
      if (b.err) return reply(b.err);
      const flip = Math.random() < 0.5 ? "heads" : "tails";
      if (flip === side) {
        w.coins += b.bet;
        return reply(`🪙 ${flip}! You won ${fmt(b.bet)} 🪙\nBalance: ${fmt(w.coins)} 🪙`);
      }
      w.coins -= b.bet;
      return reply(`🪙 ${flip}. You lost ${fmt(b.bet)} 🪙\nBalance: ${fmt(w.coins)} 🪙`);
    }
    case "/slots": {
      const w = wallet(senderJid(msg));
      const b = parseBet(args[0], w);
      if (b.err) return reply(b.err);
      const r = [pick(slotSymbols), pick(slotSymbols), pick(slotSymbols)];
      const uniq = new Set(r).size;
      let net = -b.bet;
      let label = "No match";
      if (uniq === 1) {
        net = b.bet * 10;
        label = "JACKPOT!";
      } else if (uniq === 2) {
        net = Math.floor(b.bet / 2);
        label = "Two of a kind";
      }
      w.coins += net;
      return reply(
        `🎰 ${r.join(" ")}\n${label} ${net >= 0 ? "+" : ""}${fmt(net)} 🪙\nBalance: ${fmt(w.coins)} 🪙`
      );
    }
    case "/dicebet": {
      const w = wallet(senderJid(msg));
      const guess = parseInt(args[1], 10);
      if (!(guess >= 1 && guess <= 6))
        return reply("Usage: /dicebet <amount> <1-6>");
      const b = parseBet(args[0], w);
      if (b.err) return reply(b.err);
      const roll = Math.floor(Math.random() * 6) + 1;
      if (roll === guess) {
        w.coins += b.bet * 5;
        return reply(`🎲 ${roll}! You won ${fmt(b.bet * 5)} 🪙\nBalance: ${fmt(w.coins)} 🪙`);
      }
      w.coins -= b.bet;
      return reply(`🎲 ${roll}. You lost ${fmt(b.bet)} 🪙\nBalance: ${fmt(w.coins)} 🪙`);
    }
   case "/add": {
      if (!isGroup) return reply("This only works in groups.");
      if (!isOwner(msg) && !(await isGroupAdmin(sock, jid, msg)))
        return reply("Only group admins can use /add.");
      const numbers = args
        .join(" ")
        .split(",")
        .map((s) => s.replace(/\D/g, ""))
        .filter((n) => n.length >= 8 && n.length <= 15)
        .slice(0, 5);
      if (!numbers.length)
        return reply(
          "Usage: /add <number with country code>\nExample: /add 8801XXXXXXXXX\nSeveral numbers: separate them with commas."
        );
      const lines = [];
      for (const n of numbers) {
        try {
          const res = await sock.groupParticipantsUpdate(
            jid,
            [`${n}@s.whatsapp.net`],
            "add"
          );
          const st = String(res?.[0]?.status || "");
          if (st === "200") lines.push(`✅ ${n} added`);
          else if (st === "409") lines.push(`ℹ️ ${n} is already in the group`);
          else if (st === "403")
            lines.push(`🔒 ${n} can't be added (their privacy settings need an invite link)`);
          else if (st === "408")
            lines.push(`⏳ ${n} left recently and can't be re-added yet`);
          else lines.push(`❌ ${n} couldn't be added (not on WhatsApp, or error ${st})`);
        } catch (e) {
          console.error("Add error:", e.message);
          lines.push(`❌ ${n} failed. Make sure I'm a group admin.`);
        }
      }
      return reply(lines.join("\n"));
    }
    case "/pfp": {
      const ctx = msg.message.extendedTextMessage?.contextInfo;
      let target = ctx?.mentionedJid?.[0] || ctx?.participant;
      const n = args.join("").replace(/\D/g, "");
      if (!target && n.length >= 8) target = `${n}@s.whatsapp.net`;
      if (!target) target = senderJid(msg);
      try {
        const url = await sock.profilePictureUrl(target, "image");
        return sock.sendMessage(
          jid,
          {
            image: { url },
            caption: `Profile picture of @${num(target)}`,
            mentions: [target],
          },
          { quoted: msg }
        );
      } catch (e) {
        return reply(
          "I couldn't get that profile picture. It may be hidden by their privacy settings, or not set."
        );
      }
    }
    case "/saylangs":
      return reply(
        `*Language codes for /say*\n${Object.entries(TTS_LANGS)
          .map(([c, name]) => `${c} - ${name}`)
          .join("\n")}`
      );
    case "/say":
    case "/saytr": {
      let lang = "en";
      let t = args.join(" ");
      const code = ttsLang(args[0] || "");
      if (code) {
        lang = code;
        t = args.slice(1).join(" ");
      }
      if (!t)
        return reply(
          "Usage: /say <language code> <text>\nExample: /say bn আমি ভালো আছি\nUse /saytr to translate first: /saytr bn how are you\nAll codes: /saylangs"
        );
      if (t.length > 500)
        return reply("Text is too long. Keep it under 500 characters.");
      try {
        if (cmd === "/saytr") {
          t = await askAI(
            AI_MODELS,
            "LING_KEY",
            `Translate the text below into ${TTS_LANGS[lang]}. Reply with only the translation.\n\n${t}`
          );
        }
        const audio = await ttsGoogle(t.slice(0, 500), lang);
        return sock.sendMessage(
          jid,
          { audio, mimetype: "audio/mpeg" },
          { quoted: msg }
        );
      } catch (e) {
        console.error("Say error:", e.message);
        return reply("Voice failed. Try again later.");
      }
    }
    case "/hello":
      return reply("Hello!");
    case "/ping":
      return reply("pong");
    case "/help":
      return reply(helpText);
    case "/joke":
      return reply(pick(jokes));
    case "/quote":
      return reply(pick(quotes));
    case "/dice":
      return reply(`🎲 You rolled a ${Math.floor(Math.random() * 6) + 1}`);
    case "/flip":
      return reply(Math.random() < 0.5 ? "🪙 Heads" : "🪙 Tails");
    case "/8ball":
      if (!args.length) return reply("Ask a question, e.g. /8ball will I pass?");
      return reply(`🎱 ${pick(eightBall)}`);
    case "/rps": {
      const choices = ["rock", "paper", "scissors"];
      const me = (args[0] || "").toLowerCase();
      if (!choices.includes(me)) return reply("Use: /rps rock, /rps paper or /rps scissors");
      const bot = pick(choices);
      let result = "It's a draw!";
      if (
        (me === "rock" && bot === "scissors") ||
        (me === "paper" && bot === "rock") ||
        (me === "scissors" && bot === "paper")
      )
        result = "You win!";
      else if (me !== bot) result = "I win!";
      return reply(`You: ${me}\nMe: ${bot}\n${result}`);
    }
    case "/time": {
      const now = new Date().toLocaleString("en-GB", { timeZone: TIMEZONE });
      return reply(`🕒 ${now}`);
    }
    case "/rules":
      return reply(`*Group rules*\n${rules.join("\n")}`);
    case "/music": {
      const q = args.join(" ");
      if (!q) return reply("Usage: /music <song name>");
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const data = await res.json();
        const song = data.results?.[0];
        if (!song?.previewUrl) return reply("Couldn't find that song.");
        await reply(`🎵 ${song.trackName} - ${song.artistName}\n(30-second preview)`);
        await sock.sendMessage(
          jid,
          { audio: { url: song.previewUrl }, mimetype: "audio/mp4" },
          { quoted: msg }
        );
      } catch (e) {
        console.error("Music error:", e.message);
        return reply("Music search failed. Try again later.");
      }
      return;
    }
    case "/musiclinks": {
      const q = args.join(" ");
      if (!q) return reply("Usage: /music <song name>");
      const enc = encodeURIComponent(q);
      return reply(
        `🎵 Search for "${q}":\nYouTube: https://www.youtube.com/results?search_query=${enc}\nSpotify: https://open.spotify.com/search/${enc}`
      );
    }
    case "/img": {
      const q = args.join(" ");
      if (!q) return reply("Usage: /img <search words>");
      try {
        const api =
          "https://en.wikipedia.org/w/api.php?action=query&generator=search" +
          `&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5` +
          "&prop=pageimages&piprop=thumbnail&pithumbsize=800&format=json";
        const headers = { "User-Agent": "WhatsAppGroupBot/1.0 (hobby bot)" };
        const res = await fetch(api, { headers, signal: AbortSignal.timeout(20000) });
        const data = await res.json();
        const pages = Object.values(data.query?.pages || {})
          .filter((p) => p.thumbnail?.source)
          .sort((a, b) => a.index - b.index);
        if (!pages.length) return reply("No picture found for that search.");
        const page = pages[0];
        const imgRes = await fetch(page.thumbnail.source, {
          headers,
          signal: AbortSignal.timeout(30000),
        });
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        await sock.sendMessage(
          jid,
          { image: buffer, caption: page.title },
          { quoted: msg }
        );
      } catch (e) {
        console.error("Image error:", e.message);
        return reply("Image search failed. Try again later.");
      }
      return;
    }
    case "/imglinks": {
      const q = args.join(" ");
      if (!q) return reply("Usage: /img <search words>");
      const enc = encodeURIComponent(q);
      return reply(
        `🖼️ Images for "${q}":\nGoogle: https://www.google.com/search?tbm=isch&q=${enc}\nBing: https://www.bing.com/images/search?q=${enc}`
      );
    }
    case "/guess": {
      if (!args.length) {
        guessGames.set(jid, Math.floor(Math.random() * 100) + 1);
        return reply("I'm thinking of a number from 1 to 100. Guess with /guess <number>");
      }
      if (!guessGames.has(jid)) return reply("No game running. Start one with /guess");
      const n = parseInt(args[0], 10);
      if (isNaN(n)) return reply("Send a number, e.g. /guess 42");
      const target = guessGames.get(jid);
      if (n === target) {
        guessGames.delete(jid);
        return reply(`🎉 Correct! The number was ${target}.`);
      }
      return reply(n < target ? "Higher ⬆️" : "Lower ⬇️");
    }
    case "/trivia": {
      const t = pick(trivia);
      triviaGames.set(jid, t);
      return reply(`❓ ${t.q}\nAnswer with /answer <your answer>`);
    }
    case "/answer": {
      const t = triviaGames.get(jid);
      if (!t) return reply("No question yet. Start one with /trivia");
      const given = args.join(" ").toLowerCase().trim();
      if (!given) return reply("Write your answer, e.g. /answer paris");
      if (given === t.a) {
        triviaGames.delete(jid);
        return reply("✅ Correct!");
      }
      return reply("❌ Not quite. Try again!");
    }
    case "/groupinfo": {
      if (!isGroup) return reply("This only works in groups.");
      const meta = await sock.groupMetadata(jid);
      return reply(
        `*${meta.subject}*\nMembers: ${meta.participants.length}\n${meta.desc ? "About: " + meta.desc : ""}`
      );
    }
    case "/admins": {
      if (!isGroup) return reply("This only works in groups.");
      const meta = await sock.groupMetadata(jid);
      const admins = meta.participants.filter((p) => p.admin).map((p) => p.id);
      if (!admins.length) return reply("No admins found.");
      const list = admins.map((id) => `@${id.split("@")[0]}`).join("\n");
      return sock.sendMessage(
        jid,
        { text: `*Admins*\n${list}`, mentions: admins },
        { quoted: msg }
      );
    }
    case "/tagall": {
      if (!isGroup) return reply("This only works in groups.");
      const meta = await sock.groupMetadata(jid);
      const ids = meta.participants.map((p) => p.id);
      const list = ids.map((id) => `@${id.split("@")[0]}`).join(" ");
      return sock.sendMessage(jid, { text: `Everyone: ${list}`, mentions: ids });
    }
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE);
        console.log("PAIRING CODE:", code);
      } catch (e) {
        console.error("Pairing error:", e.message);
      }
    }, 3000);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") console.log("Connected!");
    if (connection === "close") {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status === DisconnectReason.loggedOut) {
        console.log("Logged out. Delete the auth folder and link again.");
      } else {
        start();
      }
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    try {
      if (update.action !== "add") return;
      for (const p of update.participants) {
        const jid = typeof p === "string" ? p : p.id;
        await sock.sendMessage(update.id, {
          text: `Welcome @${jid.split("@")[0]}! Type /help to see what I can do.`,
          mentions: [jid],
        });
      }
    } catch (e) {
      console.error("Welcome error:", e.message);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        await handle(sock, msg);
      } catch (e) {
        console.error("Command error:", e.message);
      }
    }
  });
}

start();
