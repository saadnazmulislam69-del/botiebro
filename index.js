import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
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
const guessGames = new Map();
const triviaGames = new Map();

async function handle(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;
  const jid = msg.key.remoteJid;
  const isGroup = jid.endsWith("@g.us");
  const text =
    msg.message.conversation || msg.message.extendedTextMessage?.text || "";
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const args = parts.slice(1);
  if (!cmd.startsWith("/")) return;
  console.log("MSG:", jid, text);

  const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

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
