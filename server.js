const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================= AI INTENT DETECTION =================
async function detectIntent(question) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Classify this into one word: weather, sports, time, or general: "${question}"` }]
  });
  return response.choices[0].message.content.toLowerCase();
}

// ================= TOOLS =================
async function getWeather() {
  try {
    const response = await fetch("https://wttr.in/Bangalore?format=j1");
    const data = await response.json();
    const temp = data.current_condition[0].temp_C;
    const desc = data.current_condition[0].weatherDesc[0].value;
    return `🌦️ Bangalore: ${temp}°C, ${desc}`;
  } catch (err) { return "Weather service unavailable"; }
}

// ================= MAIN CHAT =================
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    const intent = await detectIntent(question);

    let result;
    if (intent.includes("weather")) {
      result = await getWeather();
    } else if (intent.includes("time")) {
      result = `⏰ Current time: ${new Date().toLocaleString()}`;
    } else {
      const ai = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: question }]
      });
      result = ai.choices[0].message.content;
    }
    res.json({ answer: result });
  } catch (err) {
    res.status(500).json({ answer: "Something went wrong" });
  }
});

// ================= IMAGE ANALYSIS (FIXED) =================
app.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.json({ answer: "No image uploaded" });

    const imageBase64 = fs.readFileSync(req.file.path, { encoding: "base64" });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image briefly." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    // Clean up file after reading
    fs.unlinkSync(req.file.path);

    res.json({ answer: response.choices[0].message.content });
  } catch (err) {
    console.error("OpenAI Error:", err.message);
    res.json({ answer: "Image analysis failed." });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));