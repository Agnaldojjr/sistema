import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI initialization
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API routes
  app.post("/api/suggest-prescription", async (req, res) => {
    try {
      const { procedure } = req.body;
      if (!procedure) {
        return res.status(400).json({ error: "Procedimento não informado." });
      }

      const prompt = `Você é um dentista experiente. O usuário vai descrever o procedimento odontológico realizado e você deve sugerir automaticamente a prescrição e instruções (posologia) para o receituário do paciente.
Por favor, liste as medicações (ex: 1. Amoxicilina 500mg - Tomar 1 cp a cada 8h por 7 dias) e em seguida as recomendações principais relacionadas ao procedimento.
Responda sempre em português, em um formato claro, para o paciente ler diretamente.
Não inclua nenhuma introdução nem saudação ("Olá, aqui está..."), responda apenas com as prescrições médicas formatadas.
Não use markdown complexo, pode usar números ou traços.

Procedimento realizado: ${procedure}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2, // low temp for clinical stuff
        }
      });

      res.json({ suggestion: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      const msg = error?.message || error?.toString?.() || "Failed to generate prescription";
      
      if (
        msg.includes("prepayment credits are depleted") || 
        msg.includes("RESOURCE_EXHAUSTED") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        error?.status === 429
      ) {
        return res.status(429).json({ error: "Créditos da API Google Gemini esgotados. Verifique seu projeto no AI Studio e o faturamento. O plano gratuito pode ter sido excedido." });
      }
      res.status(500).json({ error: "Erro ao conectar com a inteligência artificial. Tente novamente mais tarde." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
