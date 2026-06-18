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
    '🚀 HÀNG MỚI VỀ KHO',
    '',
    `🤖 ${renderValue(payload.serviceName)}`,
    `📂 ${renderValue(payload.categoryName)}`,
    `📦 ${renderValue(payload.variantName)}`,
    '',
    `➕ Vừa cập nhật: ${payload.quantity} tài khoản`,
    '',
    '✅ Đã sẵn sàng để đặt mua.',
    '',
    '🛒 Truy cập AI Store để xem chi tiết.',
  ].join('\n');
}

export function renderOutOfStockNotification(payload: StockNotificationProduct) {
  return [
    '📢 HẾT HÀNG',
    '',
    `🤖 ${renderValue(payload.serviceName)}`,
    `📂 ${renderValue(payload.categoryName)}`,
    `📦 ${renderValue(payload.variantName)}`,
    '',
    '🔥 Toàn bộ tài khoản đã được bán hết.',
    '',
    '⏳ Chúng tôi đang bổ sung thêm hàng và sẽ cập nhật sớm nhất.',
  ].join('\n');
}

function renderValue(value?: string | null) {
  if (!value) return '-';
  return value;
}
