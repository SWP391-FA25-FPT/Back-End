import { qdrantClient, AI_CHAT_COLLECTION, VECTOR_SIZE, ensureAiChatCollection } from "../config/qdrant.js";
import { embedText } from "./embeddings.js";

function generatePointId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

async function validateCollectionVectorSize(expectedSize) {
  try {
    const info = await qdrantClient.getCollection(AI_CHAT_COLLECTION);
    const actualSize = info?.config?.params?.vectors?.size;
    if (typeof actualSize === "number" && actualSize !== expectedSize) {
      console.warn(
        `[Qdrant] Vector size mismatch. Expected=${expectedSize}, Actual=${actualSize}. Consider recreating ${AI_CHAT_COLLECTION}`
      );
    }
  } catch (e) {
    console.warn("[Qdrant] Could not fetch collection info:", e?.message || e);
  }
}

export async function upsertChatMessage({
  userId,
  conversationId,
  role, // 'user' | 'ai'
  content,
  timestamp = new Date().toISOString(),
}) {
  await ensureAiChatCollection();
  await validateCollectionVectorSize(VECTOR_SIZE);
  const vector = await embedText(content);

  // Safety: align vector length if needed
  if (VECTOR_SIZE && vector.length !== VECTOR_SIZE) {
    // Simple truncate/pad strategy
    const fixed = new Array(VECTOR_SIZE).fill(0);
    for (let i = 0; i < Math.min(VECTOR_SIZE, vector.length); i += 1) fixed[i] = vector[i];
    try {
      if (process.env.QDRANT_DEBUG === "true") {
        console.log("[Qdrant] upsert", { conversationId, role, userId, vectorLen: fixed.length, hasContent: !!content });
      }
      return await qdrantClient.upsert(AI_CHAT_COLLECTION, {
        points: [
          {
            id: generatePointId(),
            vector: fixed,
            payload: { userId, conversationId, role, content, timestamp },
          },
        ],
      });
    } catch (err) {
      console.error("[Qdrant] Upsert error:", err?.response?.data || err?.message || err);
      throw err;
    }
  }

  try {
    if (process.env.QDRANT_DEBUG === "true") {
      console.log("[Qdrant] upsert", { conversationId, role, userId, vectorLen: vector.length, hasContent: !!content });
    }
    return await qdrantClient.upsert(AI_CHAT_COLLECTION, {
      points: [
        {
          id: generatePointId(),
          vector,
          payload: { userId, conversationId, role, content, timestamp },
        },
      ],
    });
  } catch (err) {
    console.error("[Qdrant] Upsert error:", err?.response?.data || err?.message || err);
    throw err;
  }
}

export async function listUserConversations({ userId, limit = 50 }) {
  await ensureAiChatCollection();
  const res = await qdrantClient.scroll(AI_CHAT_COLLECTION, {
    limit,
    filter: {
      must: [
        { key: "userId", match: { value: userId } },
      ],
    },
    with_payload: true,
    with_vectors: false,
  });
  const items = res?.points || [];
  const map = new Map();
  for (const p of items) {
    const payload = p.payload || {};
    if (!payload.conversationId) continue;
    const existing = map.get(payload.conversationId) || { conversationId: payload.conversationId, lastTimestamp: "", messageCount: 0 };
    existing.messageCount += 1;
    if (!existing.lastTimestamp || new Date(payload.timestamp) > new Date(existing.lastTimestamp)) {
      existing.lastTimestamp = payload.timestamp;
    }
    map.set(payload.conversationId, existing);
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
}

export async function getConversationMessages({ userId, conversationId, limit = 500 }) {
  await ensureAiChatCollection();
  const res = await qdrantClient.scroll(AI_CHAT_COLLECTION, {
    limit,
    filter: {
      must: [
        { key: "userId", match: { value: userId } },
        { key: "conversationId", match: { value: conversationId } },
      ],
    },
    with_payload: true,
    with_vectors: false,
  });
  const items = res?.points || [];
  return items
    .map((p) => p.payload)
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export async function listRecentMessages({ conversationId, limit = 30 }) {
  await ensureAiChatCollection();
  const res = await qdrantClient.scroll(AI_CHAT_COLLECTION, {
    limit,
    filter: {
      must: [
        {
          key: "conversationId",
          match: { value: conversationId },
        },
      ],
    },
    with_payload: true,
    with_vectors: false,
  });
  const items = res?.points || [];
  return items
    .map((p) => p.payload)
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export async function semanticSearchInConversation({ conversationId, query, limit = 10 }) {
  await ensureAiChatCollection();
  const queryVector = await embedText(query);
  const result = await qdrantClient.search(AI_CHAT_COLLECTION, {
    vector: queryVector,
    limit,
    filter: {
      must: [
        { key: "conversationId", match: { value: conversationId } },
      ],
    },
    with_payload: true,
    with_vectors: false,
  });
  return (result || []).map((r) => ({ score: r.score, ...r.payload }));
}


