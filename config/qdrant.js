import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || undefined;

export const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

export const AI_CHAT_COLLECTION = process.env.QDRANT_COLLECTION || "ai_conversations";

// text-embedding-004 = 768 dims
export const VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE || 768);

export async function ensureAiChatCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections?.some((c) => c.name === AI_CHAT_COLLECTION);
    if (!exists) {
      await qdrantClient.createCollection(AI_CHAT_COLLECTION, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
    }

    // Ensure payload indexes for filtering
    const ensureIndex = async (field) => {
      try {
        await qdrantClient.createPayloadIndex(AI_CHAT_COLLECTION, {
          field_name: field,
          field_schema: "keyword",
        });
      } catch (e) {
        // If already exists or not supported, ignore
        const msg = e?.response?.data || e?.message || "";
        if (process.env.QDRANT_DEBUG === "true") {
          console.log(`[Qdrant] createPayloadIndex ${field}:`, msg);
        }
      }
    };

    await ensureIndex("userId");
    await ensureIndex("conversationId");
  } catch (err) {
    console.error("Qdrant ensure collection error:", err?.message || err);
    throw err;
  }
}

// Log connection status (non-blocking)
qdrantClient
  .getCollections()
  .then(() => {
    console.log(`✅ Qdrant Connected`);
    console.log(`🗄️  Collection: ${AI_CHAT_COLLECTION} | URL: ${QDRANT_URL}`);
  })
  .catch((err) => {
    console.error("❌ Qdrant connection failed:", err?.message || err);
  });


