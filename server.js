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

// Ensure upload directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================= MAIN CHAT ROUTE =================
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ answer: "No question provided" });

    // Using the standard chat completions API
    const aiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: question }],
    });

    const result = aiResponse.choices[0].message.content;
    res.json({ answer: result });

  } catch (err) {
    console.error("Chat Error:", err.message);
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
            { type: "text", text: "What is in this image?" },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    // Delete file after processing to save space
    fs.unlinkSync(req.file.path);

    res.json({ answer: response.choices[0].message.content });
  } catch (err) {
    console.error("Image Error:", err.message);
    res.status(500).json({ answer: "Could not analyze the image." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));