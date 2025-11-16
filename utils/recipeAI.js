import Recipe from "../models/Recipe.js";

/**
 * Extract user preferences from conversation history
 * Analyzes messages to identify dietary patterns, restrictions, and goals
 */
export function extractUserPreferences(conversationHistory = []) {
  const preferences = {
    tags: new Set(),
    includeIngredients: new Set(),
    excludeIngredients: new Set(),
    maxCalories: null,
    minProtein: null,
    dietaryRestrictions: new Set(),
  };

  // Keywords mapping for Vietnamese and English
  const tagKeywords = {
    healthy: ["healthy", "lành mạnh", "bổ dưỡng", "dinh dưỡng"],
    "Giảm cân": ["giảm cân", "weight loss", "lose weight", "ăn kiêng", "diet", "low calorie", "ít calo"],
    "Tăng cơ": ["tăng cơ", "muscle gain", "muscle", "cơ bắp", "protein cao", "high protein"],
    Chay: ["chay", "vegetarian", "không thịt", "no meat", "vegan", "thuần chay"],
    Keto: ["keto", "low carb", "ít carb", "ketogenic"],
    "Ăn sạch": ["ăn sạch", "clean eating", "organic", "hữu cơ"],
    "Tăng cường miễn dịch": ["miễn dịch", "immunity", "immune", "sức khỏe"],
  };

  const ingredientKeywords = {
    include: ["có", "với", "thêm", "include", "with", "add"],
    exclude: ["không", "không có", "bỏ", "without", "no", "exclude", "dị ứng", "allergy", "allergic"],
  };

  // Analyze each message
  conversationHistory.forEach((msg) => {
    const content = (msg.content || "").toLowerCase();

    // Extract tags from keywords
    Object.entries(tagKeywords).forEach(([tag, keywords]) => {
      if (keywords.some((keyword) => content.includes(keyword))) {
        preferences.tags.add(tag);
      }
    });

    // Extract calorie goals
    const calorieMatch = content.match(/(?:dưới|under|below|<|max|tối đa)\s*(\d+)\s*(?:calories|calo|kcal)/i);
    if (calorieMatch) {
      const calories = parseInt(calorieMatch[1]);
      if (!preferences.maxCalories || calories < preferences.maxCalories) {
        preferences.maxCalories = calories;
      }
    }

    // Extract protein goals
    const proteinMatch = content.match(/(?:trên|over|above|>|min|tối thiểu)\s*(\d+)\s*(?:g|gram)?\s*protein/i);
    if (proteinMatch) {
      const protein = parseInt(proteinMatch[1]);
      if (!preferences.minProtein || protein > preferences.minProtein) {
        preferences.minProtein = protein;
      }
    }

    // Extract ingredient preferences (simple pattern matching)
    // Look for phrases like "có gà", "không có sữa", "with chicken", "without milk"
    const ingredientPatterns = [
      /(?:có|with|add|thêm)\s+([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+?)(?:\s|,|$)/gi,
      /(?:không có|không|without|no|exclude|bỏ)\s+([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+?)(?:\s|,|$)/gi,
    ];

    let match;
    // Include ingredients
    while ((match = ingredientPatterns[0].exec(content)) !== null) {
      const ingredient = match[1].trim();
      if (ingredient.length > 2 && ingredient.length < 30) {
        preferences.includeIngredients.add(ingredient);
      }
    }

    // Exclude ingredients
    while ((match = ingredientPatterns[1].exec(content)) !== null) {
      const ingredient = match[1].trim();
      if (ingredient.length > 2 && ingredient.length < 30) {
        preferences.excludeIngredients.add(ingredient);
      }
    }

    // Dietary restrictions / allergies
    const allergyKeywords = ["dị ứng", "allergy", "allergic", "không ăn được"];
    allergyKeywords.forEach((keyword) => {
      if (content.includes(keyword)) {
        // Extract what they're allergic to
        const allergyMatch = content.match(new RegExp(`${keyword}\\s+([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\\s]+?)(?:\\s|,|\\.|$)`, "i"));
        if (allergyMatch) {
          preferences.dietaryRestrictions.add(allergyMatch[1].trim());
          preferences.excludeIngredients.add(allergyMatch[1].trim());
        }
      }
    });
  });

  // Convert Sets to Arrays for easier use
  return {
    tags: Array.from(preferences.tags),
    includeIngredients: Array.from(preferences.includeIngredients),
    excludeIngredients: Array.from(preferences.excludeIngredients),
    maxCalories: preferences.maxCalories,
    minProtein: preferences.minProtein,
    dietaryRestrictions: Array.from(preferences.dietaryRestrictions),
  };
}

/**
 * Check if user message is requesting recipe suggestions
 */
export function detectRecipeRequest(message = "") {
  const content = message.toLowerCase();
  
  const recipeKeywords = [
    // Direct recipe requests
    "công thức", "recipe", "món ăn", "nấu gì", "ăn gì", "làm gì",
    "gợi ý món", "suggest", "recommend", "đề xuất",
    
    // Food-related queries
    "muốn ăn", "want to eat", "làm món", "nấu món",
    "món healthy", "món giảm cân", "món chay",
    
    // Meal planning
    "thực đơn", "meal plan", "menu", "bữa ăn",
    
    // Specific searches
    "có món nào", "any dish", "any recipe", "món nào",
    "tìm món", "search", "find recipe",
  ];

  return recipeKeywords.some((keyword) => content.includes(keyword));
}

/**
 * Extract search criteria from current message
 */
export function extractSearchCriteria(message = "", historicalPreferences = {}) {
  const content = message.toLowerCase();
  const criteria = {
    tags: new Set(historicalPreferences.tags || []),
    includeIngredients: [],
    excludeIngredients: [],
    maxCalories: historicalPreferences.maxCalories || null,
    minProtein: historicalPreferences.minProtein || null,
    sortBy: "trustScore", // Default to trusted recipes
    limit: 10,
  };

  // Tag keywords
  const tagKeywords = {
    healthy: ["healthy", "lành mạnh", "bổ dưỡng"],
    "Giảm cân": ["giảm cân", "weight loss", "lose weight", "ăn kiêng", "diet"],
    "Tăng cơ": ["tăng cơ", "muscle", "cơ bắp", "protein"],
    Chay: ["chay", "vegetarian", "vegan", "không thịt"],
    Keto: ["keto", "low carb", "ít carb"],
    "Ăn sạch": ["ăn sạch", "clean eating", "organic"],
  };

  Object.entries(tagKeywords).forEach(([tag, keywords]) => {
    if (keywords.some((keyword) => content.includes(keyword))) {
      criteria.tags.add(tag);
    }
  });

  // Calorie extraction from current message
  const calorieMatch = content.match(/(?:dưới|under|below|<|max)\s*(\d+)\s*(?:calories|calo|kcal)/i);
  if (calorieMatch) {
    criteria.maxCalories = parseInt(calorieMatch[1]);
  }

  // Convert tags Set to Array
  criteria.tags = Array.from(criteria.tags);

  // If no specific tags, make it more general
  if (criteria.tags.length === 0) {
    criteria.tags = null;
  }

  return criteria;
}

/**
 * Search recipes from MongoDB based on AI criteria
 */
export async function searchRecipesForAI(criteria = {}) {
  try {
    const {
      tags = null,
      includeIngredients = [],
      excludeIngredients = [],
      maxCalories = null,
      minProtein = null,
      sortBy = "trustScore",
      limit = 10,
    } = criteria;

    // Build MongoDB query
    const query = { status: "published" };

    // Filter by tags (if specified)
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    // Filter by ingredients - include
    if (includeIngredients && includeIngredients.length > 0) {
      query["ingredients.name"] = {
        $regex: new RegExp(includeIngredients.join("|"), "i"),
      };
    }

    // Filter by ingredients - exclude
    if (excludeIngredients && excludeIngredients.length > 0) {
      query["ingredients.name"] = {
        ...(query["ingredients.name"] || {}),
        $not: new RegExp(excludeIngredients.join("|"), "i"),
      };
    }

    // Filter by nutrition - max calories
    if (maxCalories) {
      query["nutrition.calories"] = { $lte: maxCalories };
    }

    // Filter by nutrition - min protein
    if (minProtein) {
      query["nutrition.protein"] = { $gte: minProtein };
    }

    // Sort options
    const sortOptions = {
      trustScore: { trustScore: -1, views: -1 },
      views: { views: -1 },
      newest: { createdAt: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.trustScore;

    // Execute query
    const recipes = await Recipe.find(query)
      .sort(sort)
      .limit(limit)
      .select("_id name description tags totalTime servings nutrition trustScore views")
      .lean();

    return recipes;
  } catch (error) {
    console.error("Search recipes for AI error:", error);
    return [];
  }
}

/**
 * Format recipe summary for AI to present to user
 */
export function formatRecipeSummary(recipe) {
  if (!recipe) return "";

  const {
    _id,
    name,
    description,
    tags = [],
    totalTime,
    servings,
    nutrition = {},
    trustScore,
  } = recipe;

  const calories = nutrition.calories || "N/A";
  const protein = nutrition.protein || "N/A";
  const tagsStr = tags.slice(0, 3).join(", ");
  const time = totalTime || "N/A";

  // Create a concise summary
  let summary = `**${name}** (ID: ${_id})\n`;
  summary += `   - ⏱️ ${time} | 🔥 ${calories} calo | 💪 ${protein}g protein | 👥 ${servings} phần\n`;
  if (tagsStr) {
    summary += `   - 🏷️ ${tagsStr}\n`;
  }
  if (trustScore >= 70) {
    summary += `   - ✅ Công thức đã được xác minh (Trust Score: ${trustScore})\n`;
  }
  if (description) {
    const shortDesc = description.length > 100 
      ? description.substring(0, 97) + "..." 
      : description;
    summary += `   - 📝 ${shortDesc}\n`;
  }

  return summary;
}

/**
 * Format multiple recipes into a formatted list for AI context
 */
export function formatRecipeListForAI(recipes = []) {
  if (!recipes || recipes.length === 0) {
    return null;
  }

  let formatted = "\n\n=== CÔNG THỨC KHẢ DỤNG TRONG DATABASE ===\n";
  formatted += "Dưới đây là các công thức nấu ăn phù hợp từ database. Hãy giới thiệu những món này cho người dùng một cách thân thiện và hữu ích:\n\n";

  recipes.forEach((recipe, index) => {
    formatted += `${index + 1}. ${formatRecipeSummary(recipe)}\n`;
  });

  formatted += "\n=== HƯỚNG DẪN ===\n";
  formatted += "- Giới thiệu 3-5 món phù hợp nhất với nhu cầu người dùng\n";
  formatted += "- Giải thích tại sao món đó phù hợp (calories, tags, thời gian...)\n";
  formatted += "- Nói với người dùng họ có thể tìm kiếm món bằng tên hoặc ID để xem chi tiết\n";
  formatted += "- Sử dụng emoji và trình bày thân thiện, dễ đọc\n";
  formatted += "===========================================\n\n";

  return formatted;
}

/**
 * Build enriched context summary for AI
 */
export function buildContextSummary(preferences = {}) {
  if (!preferences || Object.keys(preferences).length === 0) {
    return "";
  }

  let summary = "\n\n=== THÔNG TIN NGỮ CẢNH VỀ NGƯỜI DÙNG ===\n";

  if (preferences.tags && preferences.tags.length > 0) {
    summary += `- Sở thích dinh dưỡng: ${preferences.tags.join(", ")}\n`;
  }

  if (preferences.maxCalories) {
    summary += `- Mục tiêu calories: Tối đa ${preferences.maxCalories} calo/bữa\n`;
  }

  if (preferences.minProtein) {
    summary += `- Mục tiêu protein: Tối thiểu ${preferences.minProtein}g/bữa\n`;
  }

  if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
    summary += `- Hạn chế/Dị ứng: ${preferences.dietaryRestrictions.join(", ")}\n`;
  }

  if (preferences.excludeIngredients && preferences.excludeIngredients.length > 0) {
    summary += `- Không thích/Tránh: ${preferences.excludeIngredients.join(", ")}\n`;
  }

  if (preferences.includeIngredients && preferences.includeIngredients.length > 0) {
    summary += `- Thích sử dụng: ${preferences.includeIngredients.join(", ")}\n`;
  }

  summary += "\nHãy sử dụng thông tin này để đưa ra gợi ý phù hợp và cá nhân hóa!\n";
  summary += "=========================================\n\n";

  return summary;
}

