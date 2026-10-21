import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Helper to instantiate Gemini client with either user-provided custom key or server default key
function getGenAIClient(customKey?: string) {
  const key = (customKey && typeof customKey === "string" && customKey.trim().length > 0)
    ? customKey.trim()
    : (process.env.GEMINI_API_KEY || "");
  
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const DB_PATH = path.join(process.cwd(), "data", "debates.json");
let inMemoryDebates: any[] = [];

// Safe file DB operations supporting local, Cloud Run, and Vercel Serverless
async function getStoredDebates(): Promise<any[]> {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    try {
      const tmpPath = path.join("/tmp", "debates.json");
      const data = await fs.readFile(tmpPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return inMemoryDebates;
    }
  }
}

async function saveStoredDebates(debates: any[]): Promise<void> {
  inMemoryDebates = debates;
  let saved = false;
  try {
    const dir = path.dirname(DB_PATH);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    await fs.writeFile(DB_PATH, JSON.stringify(debates, null, 2));
    saved = true;
  } catch {
    // Read-only filesystem fallback
  }

  if (!saved) {
    try {
      await fs.writeFile(path.join("/tmp", "debates.json"), JSON.stringify(debates, null, 2));
    } catch {
      // In-memory fallback
    }
  }
}

// Ensure initial database exists
async function initDb() {
  try {
    const debates = await getStoredDebates();
    if (!debates || debates.length === 0) {
      await saveStoredDebates([]);
    }
  } catch (e) {
    console.warn("DB init warning (handled gracefully):", e);
  }
}

// API: Start Debate with deep factual reasoning, persona alignment, and optimal synthesis
app.post("/api/debate/generate", async (req, res) => {
  const { topic, personas, customApiKey } = req.body;
  const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
  const activeKey = (headerKey && headerKey.trim()) || (customApiKey && customApiKey.trim()) || undefined;

  if (!topic || !Array.isArray(personas) || personas.length < 2) {
    return res.status(400).json({ error: "주제 및 최소 2명 이상의 토론자 성향 설정이 필요합니다." });
  }

  const personaPrompt = personas
    .map((p, i) => `[토론자 ${i + 1}] 성향/역할/가치관: ${p}`)
    .join("\n");

  const promptContent = `[토론 주제]
${topic}

[참여 토론자 명단 및 고유 성향]
${personaPrompt}

[필수 규칙 및 지침]
1. 성향 맞춤형 정보 취합 & 완벽한 관점 몰입:
   - 각 토론자는 부여받은 성향(학문적 배경, 철학, 정치·경제적 관점, 현실적 이해관계 등)을 100% 충실히 대변해야 합니다.
   - 각 토론자는 자신의 성향 입장을 뒷받침하기 위해 **실제 보도된 국내외 최신 뉴스, 역사적/현대적 실제 시행 사례(Case Studies), 공인된 학술 논문 및 실증 연구 결과, 공신력 있는 공식 통계(OECD, 통계청, 정부 보고서 등)** 를 구체적으로 인용하며 설전을 펼쳐야 합니다.
   - 피상적인 감정적 주장을 지양하고, 실제 통계 수치와 구체적 사례를 근거로 상대방 진영의 논리적 맹점을 파고드십시오.

2. 고밀도 공방 진행 (라운드 구성):
   - 토론자들이 번갈아 가며 총 4~6회 이상 날카롭게 반박하고 논증하는 흐름을 구성하십시오.
   - 상대방의 이전 발언에서 제기된 실제 사례와 통계를 직접 인용하여 허점이나 부작용을 지적하고, 자신의 성향에 입각한 대안을 제시하십시오.

3. 심판관(Judge)의 분석 및 최적의 100% 종합 해답 (Verdict):
   - summary: 토론의 주요 쟁점과 각 성향별 핵심 근거를 객관적으로 명료하게 요약하세요.
   - verdict: 단순한 편들기나 승패 선언에 그치지 않고, 각 진영이 제시한 논거의 사실성, 실현 가능성, 부작용을 면밀히 종합하여 **가장 100%에 가까운 최적의 다각도 종합 솔루션(Optimal Synthesis Solution)** 을 도출하십시오. 어떤 정책적 절충안이나 기술적 보완책이 필요한지 구체적인 해결 로드맵을 제시하십시오.
   - scores: 각 토론자의 논리적 정합성, 실제 데이터/사례 인용 설득력, 반박력을 정밀 채점하여 모든 토론자의 점수 합계가 정확히 100점이 되도록 산정하십시오.`;

  const systemInstruction = `당신은 최고 권위의 지적 토론 중재자이자 AI 수석 판정관입니다.
토론 참가자들의 각 성향에 특화된 실제 국내외 뉴스, 학술 논문 연구 결과, 실제 정책/역사 사례, 통계 지표를 철저히 취합·분석하여 전문적이고 치열한 토론을 구현하십시오.
토론 종료 후에는 각 진영의 논리를 종합하여 현실적으로 가장 타당한 100% 최적의 종합 솔루션과 판정을 제시하십시오.
응답은 반드시 한국어로, 지정된 JSON 스키마를 엄격히 준수해야 합니다.`;

  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
  const client = getGenAIClient(activeKey);

  let lastError: any = null;
  let isQuotaExhausted = false;

  for (const modelName of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: promptContent,
        config: {
          systemInstruction,
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
                    personaName: { 
                      type: Type.STRING,
                      description: "토론자 성향 명칭 또는 이름"
                    },
                    message: { 
                      type: Type.STRING,
                      description: "실제 사례, 뉴스, 논문, 통계를 인용한 심층 발언" 
                    }
                  }
                }
              },
              summary: { 
                type: Type.STRING,
                description: "토론의 핵심 쟁점 및 성향별 논거 요약"
              },
              verdict: { 
                type: Type.STRING,
                description: "100% 최적의 종합 솔루션 및 AI 심판관 최종 판정" 
              },
              scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["personaIndex", "score"],
                  properties: {
                    personaIndex: { 
                      type: Type.NUMBER, 
                      description: "참가자 0-based 인덱스" 
                    },
                    score: { 
                      type: Type.NUMBER, 
                      description: "승률 및 논리 점수 (합계 100)" 
                    }
                  }
                }
              }
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({
        ...parsed,
        id: Date.now().toString(),
        topic,
        personasUsed: personas,
        createdAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.warn(`Attempt with ${modelName} failed:`, error?.message || error);
      lastError = error;

      const errMsg = String(error?.message || "");
      const errStatus = error?.status;
      if (
        errStatus === 429 ||
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("quota") ||
        errMsg.includes("RATE_LIMIT")
      ) {
        isQuotaExhausted = true;
      }
    }
  }

  if (isQuotaExhausted) {
    return res.status(429).json({
      error: "하루 할당량이 다 소모되었습니다. 개인 API키를 입력해주세요",
      isQuotaExhausted: true,
      details: "오늘 기본 제공되는 무료 API의 하루 할당량이 모두 소모되었습니다. 개인 무료 구글 Gemini API 키를 등록하시면 대기 없이 즉시 토론을 계속 이용하실 수 있습니다."
    });
  }

  res.status(500).json({ 
    error: "토론 생성 중 오류가 발생했습니다.", 
    details: lastError?.message || "Internal error" 
  });
});

// API: Save Debate
app.post("/api/debates", async (req, res) => {
  try {
    const debates = await getStoredDebates();
    const newDebate = req.body;
    debates.unshift(newDebate);
    // Keep up to 50 recent debates
    const trimmed = debates.slice(0, 50);
    await saveStoredDebates(trimmed);
    res.status(201).json(newDebate);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save debate", details: error?.message });
  }
});

// API: Get List
app.get("/api/debates", async (req, res) => {
  try {
    const debates = await getStoredDebates();
    res.json(debates);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch debates", details: error?.message });
  }
});

// API: Delete Debate
app.delete("/api/debates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const debates = await getStoredDebates();
    const filtered = debates.filter((d: any) => d.id !== id);
    await saveStoredDebates(filtered);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete debate", details: error?.message });
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

// In Vercel serverless environment, do not call app.listen
if (!process.env.VERCEL) {
  startServer();
}

export default app;
