import { analyzeNutritionVN } from "../utils/nutritionService.js";

/**
 * @desc    Tính toán dinh dưỡng từ danh sách nguyên liệu tiếng Việt
 * @route   POST /api/nutrition/calc
 * @access  Public (có thể thêm protect nếu cần)
 */
export const calculateNutrition = async (req, res) => {
  try {
    const { ingredients } = req.body;

    // Validate input
    if (!ingredients) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng cung cấp danh sách nguyên liệu",
      });
    }

    if (!Array.isArray(ingredients)) {
      return res.status(400).json({
        success: false,
        error: "Danh sách nguyên liệu phải là một mảng",
      });
    }

    if (ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Danh sách nguyên liệu không được rỗng",
      });
    }

    // Gọi service để phân tích dinh dưỡng
    const nutrition = await analyzeNutritionVN(ingredients);

    if (!nutrition) {
      return res.status(200).json({
        success: true,
        totals: null,
        message: "Không thể tính toán dinh dưỡng từ nguyên liệu đã cung cấp",
      });
    }

    // Trả về kết quả theo format frontend mong đợi
    res.status(200).json({
      success: true,
      totals: nutrition,
    });
  } catch (error) {
    console.error("Calculate nutrition error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi tính toán dinh dưỡng",
    });
  }
};

