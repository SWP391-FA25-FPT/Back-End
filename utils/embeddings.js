import { genAI } from "../config/ai.config.js";

// Google text embedding model
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";

let embeddingModelInstance = null;

function getEmbeddingModel() {
  if (!embeddingModelInstance) {
    embeddingModelInstance = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  }
  return embeddingModelInstance;
}

export async function embedText(text) {
  const model = getEmbeddingModel();
  const input = typeof text === "string" ? text : JSON.stringify(text);
  const result = await model.embedContent({
    content: { parts: [{ text: input }] },
  });
  const vector = result?.embedding?.values || result?.data?.[0]?.embedding?.values;
  if (!vector) {
    throw new Error("Embedding failed: empty vector");
  }
  return vector;
}


