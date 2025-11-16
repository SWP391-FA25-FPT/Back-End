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

/**
 * Extract conversation context for understanding user preferences
 * Analyzes messages to identify dietary patterns, goals, and restrictions
 */
export function extractConversationContext(messages = []) {
  const context = {
    dietaryPreferences: new Set(),
    foodRestrictions: new Set(),
    nutritionGoals: new Set(),
    favoriteCuisines: new Set(),
    recentTopics: [],
  };

  // Keywords for different context categories
  const dietaryKeywords = {
    vegetarian: ["chay", "vegetarian", "không ăn thịt", "no meat"],
    vegan: ["thuần chay", "vegan"],
    keto: ["keto", "low carb", "ít carb"],
    healthy: ["healthy", "lành mạnh", "bổ dưỡng", "ăn sạch"],
    pescatarian: ["ăn cá", "pescatarian", "fish only"],
  };

  const restrictionKeywords = {
    dairy: ["sữa", "dairy", "lactose", "không uống sữa"],
    gluten: ["gluten", "gluten-free", "không gluten"],
    nuts: ["hạt", "nuts", "dị ứng hạt"],
    seafood: ["hải sản", "seafood", "dị ứng hải sản"],
  };

  const goalKeywords = {
    weightLoss: ["giảm cân", "weight loss", "lose weight", "ăn kiêng"],
    muscleGain: ["tăng cơ", "muscle gain", "build muscle", "cơ bắp"],
    healthy: ["sức khỏe", "health", "healthy living"],
    energy: ["năng lượng", "energy", "energetic"],
  };

  const cuisineKeywords = {
    vietnamese: ["việt nam", "vietnamese", "phở", "bún"],
    asian: ["châu á", "asian", "chinese", "japanese"],
    western: ["tây", "western", "pasta", "steak"],
    mediterranean: ["địa trung hải", "mediterranean"],
  };

  // Analyze messages
  messages.forEach((msg) => {
    if (!msg || !msg.content) return;
    const content = msg.content.toLowerCase();
    const role = msg.role || msg.type;

    // Only analyze user messages for preferences
    if (role !== "user") return;

    // Extract dietary preferences
    Object.entries(dietaryKeywords).forEach(([pref, keywords]) => {
      if (keywords.some((kw) => content.includes(kw))) {
        context.dietaryPreferences.add(pref);
      }
    });

    // Extract restrictions
    Object.entries(restrictionKeywords).forEach(([restriction, keywords]) => {
      if (keywords.some((kw) => content.includes(kw))) {
        context.foodRestrictions.add(restriction);
      }
    });

    // Extract goals
    Object.entries(goalKeywords).forEach(([goal, keywords]) => {
      if (keywords.some((kw) => content.includes(kw))) {
        context.nutritionGoals.add(goal);
      }
    });

    // Extract cuisines
    Object.entries(cuisineKeywords).forEach(([cuisine, keywords]) => {
      if (keywords.some((kw) => content.includes(kw))) {
        context.favoriteCuisines.add(cuisine);
      }
    });

    // Track recent topics (last 5 messages)
    if (context.recentTopics.length < 5) {
      // Extract key topics from message
      const topicMatch = content.match(/(?:muốn|want|thích|like|cần|need)\s+([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+?)(?:\s|,|\.|$)/i);
      if (topicMatch) {
        context.recentTopics.push(topicMatch[1].trim());
      }
    }
  });

  // Convert Sets to Arrays and return structured context
  return {
    dietaryPreferences: Array.from(context.dietaryPreferences),
    foodRestrictions: Array.from(context.foodRestrictions),
    nutritionGoals: Array.from(context.nutritionGoals),
    favoriteCuisines: Array.from(context.favoriteCuisines),
    recentTopics: context.recentTopics,
    hasContext: context.dietaryPreferences.size > 0 || 
                context.foodRestrictions.size > 0 || 
                context.nutritionGoals.size > 0,
  };
}


