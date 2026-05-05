const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// fetch support (for Node <18 / Render)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

// ===== Upload config =====
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ensure uploads folder exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// ===== OpenAI =====
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== JSON FILE STORAGE =====
const HISTORY_FILE = "chatHistory.json";

function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE));
  } catch {
    return {};
  }
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

// ===== WEATHER (no API key) =====
async function getWeather() {
  try {
    const response = await fetch("https://wttr.in/Bangalore?format=j1");
    const data = await response.json();

    const temp = data.current_condition[0].temp_C;
    const desc = data.current_condition[0].weatherDesc[0].value;

    return `🌦️ Bangalore: ${temp}°C, ${desc}`;
  } catch {
    return "Weather unavailable";
  }
}

// ================= CHAT =================
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question)
      return res.status(400).json({ answer: "No question provided" });

    const q = question.toLowerCase();

    // 🌦️ Weather
    if (q.includes("weather")) {
      const weather = await getWeather();
      return res.json({ answer: weather });
    }

    // ⏰ Time
    if (q.includes("time")) {
      return res.json({ answer: `⏰ ${new Date().toLocaleString()}` });
    }

    // 👤 user id
    const userId = req.headers["x-user-id"] || "default";

    let allHistory = readHistory();

    if (!allHistory[userId]) {
      allHistory[userId] = [];
    }

    let userHistory = allHistory[userId];

    // add user message
    userHistory.push({ role: "user", content: question });

    // limit memory
    if (userHistory.length > 10) {
      userHistory.shift();
    }

    // AI response
    const aiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: userHistory,
    });

    const result = aiResponse.choices[0].message.content;

    // save AI response
    userHistory.push({ role: "assistant", content: result });

    // save back to file
    allHistory[userId] = userHistory;
    saveHistory(allHistory);

    res.json({ answer: result });

  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ answer: "AI error" });
  }
});

// ================= IMAGE =================
app.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ answer: "No image uploaded" });

    if (!req.file.mimetype.startsWith("image/")) {
      fs.unlinkSync(req.file.path);
      return res.json({ answer: "Only image files allowed" });
    }

    const imageBase64 = fs.readFileSync(req.file.path, {
      encoding: "base64",
    });

    const userId = req.headers["x-user-id"] || "default";

    let allHistory = readHistory();

    if (!allHistory[userId]) {
      allHistory[userId] = [];
    }

    let userHistory = allHistory[userId];

    // add image to history
    userHistory.push({
      role: "user",
      content: [
        { type: "text", text: "Analyze this image" },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
          },
        },
      ],
    });

    // AI response
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: userHistory,
    });

    const result = response.choices[0].message.content;

    userHistory.push({ role: "assistant", content: result });

    // save back
    allHistory[userId] = userHistory;
    saveHistory(allHistory);

    // cleanup file
    fs.unlinkSync(req.file.path);

    res.json({ answer: result });

  } catch (err) {
    console.error("Image Error:", err);
    res.status(500).json({ answer: "Image processing failed" });
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});