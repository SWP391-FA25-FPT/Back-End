import jwt from 'jsonwebtoken';
// Bạn cần thay thế 'YOUR_JWT_SECRET' bằng khóa bí mật mà bạn dùng để ký token
// Khóa này thường được lưu trong file .env (ví dụ: process.env.JWT_SECRET)

export const verifyToken = (token) => {
    if (!token) {
        throw new Error('Token is missing');
    }
    
    // Giả sử token không có tiền tố 'Bearer '
    const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
        // Dùng jwt.verify để giải mã token và kiểm tra tính hợp lệ
        // Thay 'YOUR_JWT_SECRET' bằng biến môi trường JWT_SECRET thực tế của bạn
        const decoded = jwt.verify(actualToken, process.env.JWT_SECRET || 'YOUR_JWT_SECRET'); 
        
        // Trả về đối tượng đã giải mã (thường chứa user ID)
        return decoded; 
        
    } catch (error) {
        // Nếu token không hợp lệ, hết hạn, hoặc bị sửa đổi
        throw new Error('Invalid or expired token');
    }
};