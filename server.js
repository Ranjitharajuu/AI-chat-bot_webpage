const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
require("dotenv").config();
const path = require("path");
const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
const path = require("path");

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// Chat
app.post("/ask", async (req, res) => {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: req.body.question }]
    });

    res.json({ answer: response.choices[0].message.content });
  } catch {
    res.json({ answer: "Error" });
  }
});

// Image (basic)
app.post("/image", upload.single("image"), async (req, res) => {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Describe an uploaded image" }]
    });

    res.json({ answer: response.choices[0].message.content });
  } catch {
    res.json({ answer: "Image error" });
  }
});
const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));