import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const DB_PATH = path.join(process.cwd(), "data", "debates.json");

// Ensure data directory and file exist
async function initDb() {
  const dir = path.dirname(DB_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify([]));
  }
}

// API: Start Debate
app.post("/api/debate/generate", async (req, res) => {
  const { topic, personas } = req.body;

  if (!topic || !Array.isArray(personas) || personas.length < 2) {
    return res.status(400).json({ error: "Missing required fields or insufficient personas" });
  }

  const personaPrompt = personas.map((p, i) => `Persona ${i + 1}: ${p}`).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Topic: ${topic}\nTotal Participants: ${personas.length}\n${personaPrompt}\n\nPlease generate an intense multi-way debate. Each persona should speak exactly 3-4 times in a natural flow. After the debate, provide:
1. A summary of the entire debate.
2. A detailed "Judge's Verdict" (판정 결과) in Korean, analyzing which side was most logical and persuasive among all participants.
3. A logical/credibility score (probability of winning) for each participant (The sum of all scores must be exactly 100).`,
      config: {
        systemInstruction: "You are an AI Debate Judge and Facilitator. You manage high-quality multi-way debates and provide a final verdict. The response must be in JSON format. Use Korean for summary and verdict.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["rounds", "summary", "verdict", "scores"],
          properties: {
            rounds: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["personaName", "message"],
                properties: {
                  personaName: { type: Type.STRING },
                  message: { type: Type.STRING }
                }
              }
            },
            summary: { type: Type.STRING },
            verdict: { type: Type.STRING },
            scores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["personaIndex", "score"],
                properties: {
                  personaIndex: { type: Type.NUMBER, description: "0-based index of the persona" },
                  score: { type: Type.NUMBER, description: "Percentage (0-100)" }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    res.json({
      ...result,
      id: Date.now().toString(),
      topic,
      personasUsed: personas,
      createdAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate debate", details: error.message });
  }
});

// API: Save Debate
app.post("/api/debates", async (req, res) => {
  try {
    const debates = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    const newDebate = req.body;
    debates.push(newDebate);
    await fs.writeFile(DB_PATH, JSON.stringify(debates, null, 2));
    res.status(201).json(newDebate);
  } catch (error) {
    res.status(500).json({ error: "Failed to save debate" });
  }
});

// API: Get List
app.get("/api/debates", async (req, res) => {
  try {
    const debates = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    res.json(debates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch debates" });
  }
});

// API: Delete Debate
app.delete("/api/debates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const debates = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    const filtered = debates.filter((d: any) => d.id !== id);
    await fs.writeFile(DB_PATH, JSON.stringify(filtered, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete debate" });
  }
});

async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
