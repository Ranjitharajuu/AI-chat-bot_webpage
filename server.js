const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// fetch support (for Node <18 / Render)
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

// 🔥 file upload config (limit + safety)
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ensure upload folder exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 chat memory (simple global)
let chatHistory = [];


// ================= WEATHER =================
async function getWeather() {
  try {
    const response = await fetch("https://wttr.in/Bangalore?format=j1");
    const data = await response.json();

    const temp = data.current_condition[0].temp_C;
    const desc = data.current_condition[0].weatherDesc[0].value;

    return `🌦️ Bangalore: ${temp}°C, ${desc}`;
  } catch (err) {
    return "Weather service unavailable";
  }
}


// ================= CHAT =================
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ answer: "No question provided" });
    }

    const q = question.toLowerCase();

    // 🌦️ weather
    if (q.includes("weather")) {
      const weather = await getWeather();
      return res.json({ answer: weather });
    }

    // ⏰ time
    if (q.includes("time")) {
      return res.json({ answer: `⏰ ${new Date().toLocaleString()}` });
    }

    // 🧠 add to memory
    chatHistory.push({ role: "user", content: question });

    // limit memory
    if (chatHistory.length > 10) {
      chatHistory.shift();
    }

    const aiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatHistory,
    });

    const result = aiResponse.choices[0].message.content;

    chatHistory.push({ role: "assistant", content: result });

    res.json({ answer: result });

  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ answer: "AI service error" });
  }
});


// ================= IMAGE =================
app.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ answer: "No image uploaded" });
    }

    // validate file
    if (!req.file.mimetype.startsWith("image/")) {
      fs.unlinkSync(req.file.path);
      return res.json({ answer: "Only image files allowed" });
    }

    const imageBase64 = fs.readFileSync(req.file.path, {
      encoding: "base64",
    });

    // 🧠 add image to memory
    chatHistory.push({
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

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatHistory,
    });

    const result = response.choices[0].message.content;

    chatHistory.push({ role: "assistant", content: result });

    // delete file after use
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