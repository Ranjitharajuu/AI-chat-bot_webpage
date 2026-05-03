const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// 🔥 FIX: add fetch support (important for Node < 18 or Render)
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Ensure upload directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// ================= WEATHER FUNCTION (NO API KEY) =================
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


// ================= MAIN CHAT ROUTE =================
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ answer: "No question provided" });

    const q = question.toLowerCase();

    // 🔥 Real-time routing
    if (q.includes("weather")) {
      const weather = await getWeather();
      return res.json({ answer: weather });
    }

    if (q.includes("time")) {
      return res.json({ answer: `⏰ ${new Date().toLocaleString()}` });
    }

    // 🤖 AI fallback
    const aiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: question }],
    });

    const result = aiResponse.choices[0].message.content;

    res.json({ answer: result });

  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ answer: "AI service is currently unavailable." });
  }
});


// ================= IMAGE ANALYSIS ROUTE =================
app.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ answer: "No image uploaded" });

    const imageBase64 = fs.readFileSync(req.file.path, { encoding: "base64" });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image clearly" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    });

    // delete uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ answer: response.choices[0].message.content });

  } catch (err) {
    console.error("Image Error:", err);
    res.status(500).json({ answer: "Could not analyze the image." });
  }
});


// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));