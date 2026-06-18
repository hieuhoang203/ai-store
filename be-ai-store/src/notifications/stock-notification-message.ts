export type StockNotificationProduct = {
  serviceName: string;
  categoryName?: string | null;
  variantName?: string | null;
};

export type NewStockNotificationPayload = StockNotificationProduct & {
  quantity: number;
};

export function renderNewStockNotification(payload: NewStockNotificationPayload) {
  return [
    '🚀 HÀNG MỚI ĐÃ CẬP BẾN TẠI AI STORE',
    '',
    'AI Store vừa cập nhật thêm tài khoản mới vào kho hàng.',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '📦 THÔNG TIN SẢN PHẨM',
    '━━━━━━━━━━━━━━━━━━',
    '',
    `🤖 Dịch vụ: ${renderValue(payload.serviceName)}`,
    '',
    '📂 Danh mục:',
    renderValue(payload.categoryName),
    '',
    '📅 Gói:',
    renderValue(payload.variantName),
    '',
    '📦 Số lượng vừa cập nhật:',
    `${payload.quantity} tài khoản`,
    '',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '✅ Tài khoản đã sẵn sàng để đặt mua ngay.',
    '',
    '⚡ Số lượng có hạn và được cập nhật theo thời gian thực.',
    '',
    '🛡️ Tất cả tài khoản đều được kiểm tra trước khi giao đến khách hàng.',
    '',
    '📞 Nếu cần tư vấn hoặc hỗ trợ lựa chọn gói phù hợp, vui lòng liên hệ đội ngũ hỗ trợ của AI Store.',
    '',
    'Cảm ơn bạn đã luôn tin tưởng và đồng hành cùng AI Store ❤️',
  ].join('\n');
}

export function renderOutOfStockNotification(payload: StockNotificationProduct) {
  return [
    '📢 THÔNG BÁO HẾT HÀNG',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '📦 SẢN PHẨM',
    '━━━━━━━━━━━━━━━━━━',
    '',
    `🤖 Dịch vụ: ${renderValue(payload.serviceName)}`,
    '',
    '📂 Danh mục:',
    renderValue(payload.categoryName),
    '',
    '📅 Gói:',
    renderValue(payload.variantName),
    '',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '🔥 Toàn bộ tài khoản hiện đã được khách hàng đặt mua hết.',
    '',
    '🙏 AI Store chân thành cảm ơn sự tin tưởng và ủng hộ của quý khách trong thời gian qua.',
    '',
    'Chúng tôi cam kết:',
    '',
    '✅ Chỉ cung cấp tài khoản chất lượng và được kiểm tra kỹ trước khi giao.',
    '',
    '✅ Luôn minh bạch về số lượng tồn kho.',
    '',
    '✅ Không nhận thanh toán đối với các tài khoản không còn khả dụng.',
    '',
    '⏳ Đội ngũ AI Store đang tích cực bổ sung nguồn hàng mới và sẽ cập nhật sớm nhất có thể.',
    '',
    '📢 Ngay khi có tài khoản mới, hệ thống sẽ gửi thông báo đến khách hàng.',
    '',
    'Xin cảm ơn sự tin tưởng của bạn ❤️',
    '',
    'AI Store Team',
  ].join('\n');
}

function renderValue(value?: string | null) {
  if (!value) return '-';
  return value;
}
