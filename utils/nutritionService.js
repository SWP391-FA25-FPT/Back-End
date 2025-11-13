import axios from "axios";
import { translate } from "@vitalets/google-translate-api/dist/cjs/index.js";
import { EDAMAM_URL } from "../config/edamam.config.js";

/**
 * Phân tích dinh dưỡng từ danh sách nguyên liệu tiếng Việt
 * @param {string[]} ingredientsVN - Mảng các nguyên liệu bằng tiếng Việt
 * @returns {Promise<Object|null>} - Object chứa thông tin dinh dưỡng hoặc null nếu lỗi
 */
export async function analyzeNutritionVN(ingredientsVN) {
  try {
    // Validate input
    if (!Array.isArray(ingredientsVN) || ingredientsVN.length === 0) {
      console.log("⚠️ Danh sách nguyên liệu rỗng hoặc không hợp lệ");
      return null;
    }

    // Lọc bỏ các nguyên liệu rỗng
    const validIngredients = ingredientsVN
      .map((ing) => (typeof ing === "string" ? ing.trim() : ""))
      .filter((ing) => ing.length > 0);

    if (validIngredients.length === 0) {
      console.log("⚠️ Không có nguyên liệu hợp lệ");
      return null;
    }

    console.log("📝 Gốc tiếng Việt:", validIngredients);

    // 1️⃣ Gộp các nguyên liệu thành 1 đoạn văn để dịch một lần
    const textToTranslate = validIngredients.join("\n");
    const res = await translate(textToTranslate, { from: "vi", to: "en" });

    // 2️⃣ Tách kết quả dịch lại thành mảng theo dòng
    const translated = res.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    console.log("✅ Dịch sang tiếng Anh:", translated);

    // 3️⃣ Gọi API Edamam
    const body = { title: "Vietnamese Recipe", ingr: translated };
    const response = await axios.post(EDAMAM_URL, body, {
      headers: { "Content-Type": "application/json" },
    });

    const data = response.data;
    let n = data.totalNutrients;

    // 4️⃣ Nếu Edamam không trả tổng, tự cộng từ từng nguyên liệu
    if (!n && data.ingredients) {
      n = {
        ENERC_KCAL: { quantity: 0 },
        PROCNT: { quantity: 0 },
        FAT: { quantity: 0 },
        CHOCDF: { quantity: 0 },
        FIBTG: { quantity: 0 },
        SUGAR: { quantity: 0 },
      };

      for (const item of data.ingredients) {
        const nut = item.parsed?.[0]?.nutrients || {};
        n.ENERC_KCAL.quantity =
          (n.ENERC_KCAL.quantity || 0) + (nut.ENERC_KCAL?.quantity || 0);
        n.PROCNT.quantity = (n.PROCNT.quantity || 0) + (nut.PROCNT?.quantity || 0);
        n.FAT.quantity = (n.FAT.quantity || 0) + (nut.FAT?.quantity || 0);
        n.CHOCDF.quantity = (n.CHOCDF.quantity || 0) + (nut.CHOCDF?.quantity || 0);
        n.FIBTG.quantity = (n.FIBTG.quantity || 0) + (nut.FIBTG?.quantity || 0);
        n.SUGAR.quantity = (n.SUGAR.quantity || 0) + (nut.SUGAR?.quantity || 0);
      }
    }

    // 5️⃣ Convert sang format frontend: { calories, protein, carbs, fat, fiber, sugar }
    const nutrition = {
      calories: Math.round(n?.ENERC_KCAL?.quantity || 0),
      protein: Math.round((n?.PROCNT?.quantity || 0) * 10) / 10, // Round to 1 decimal
      carbs: Math.round((n?.CHOCDF?.quantity || 0) * 10) / 10,
      fat: Math.round((n?.FAT?.quantity || 0) * 10) / 10,
      fiber: Math.round((n?.FIBTG?.quantity || 0) * 10) / 10,
      sugar: Math.round((n?.SUGAR?.quantity || 0) * 10) / 10,
    };

    // Kiểm tra xem có giá trị nào > 0 không
    const hasAnyValue = Object.values(nutrition).some((val) => val > 0);
    if (!hasAnyValue) {
      console.log("⚠️ Không tìm thấy thông tin dinh dưỡng");
      return null;
    }

    console.log("🍽️ Nutrition:", nutrition);
    return nutrition;
  } catch (err) {
    console.error("❌ Lỗi phân tích dinh dưỡng:", err.response?.data || err.message);
    return null;
  }
}

