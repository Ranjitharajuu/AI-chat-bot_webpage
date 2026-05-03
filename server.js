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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// ================= AI ROUTER =================
async function detectIntent(question) {
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: `Classify this into one word: weather, sports, time, or general:
    "${question}"`
  });

  return response.output[0].content[0].text.toLowerCase();
}


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

// ================= SPORTS =================
async function getSports() {
  return "🏏 Live sports feature coming soon (connect CricAPI here)";
}


// ================= TIME =================
function getTime() {
  return `⏰ Current time: ${new Date().toLocaleString()}`;
}


// ================= MAIN CHAT =================
app.post("/ask", async (req, res) => {
  try {
    const question = req.body.question;

    const intent = await detectIntent(question);

    let result;

    if (intent.includes("weather")) {
      result = await getWeather();
    } 
    else if (intent.includes("sports")) {
      result = await getSports();
    } 
    else if (intent.includes("time")) {
      result = getTime();
    } 
    else {
      const ai = await client.responses.create({
        model: "gpt-4o-mini",
        input: question
      });

      result = ai.output[0].content[0].text;
    }

    res.json({ answer: result });

  } catch (err) {
    console.error(err);
    res.json({ answer: "Something went wrong" });
  }
});


// ================= IMAGE =================
app.post("/image", upload.single("image"), async (req, res) => {
  try {
    const imageBase64 = fs.readFileSync(req.file.path, {
      encoding: "base64",
    });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe this image" },
            {
              type: "input_image",
              image_base64: imageBase64,
            },
          ],
        },
      ],
    });

    res.json({
      answer: response.output[0].content[0].text
    });

  } catch (err) {
    console.error(err);
    res.json({ answer: "Image failed" });
  }
});


// ================= START =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});