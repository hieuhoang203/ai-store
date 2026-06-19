export type CouponNotificationPayload = {
  couponCode: string;
  discountText: string;
  applyScope: string;
  remainingUsage: string;
  expiredAt: string;
};

export function renderCouponNotification(payload: CouponNotificationPayload) {
  return [
    '🚨 VOUCHER MỚI ĐÃ PHÁT HÀNH',
    '',
    `🎫 Mã: ${payload.couponCode}`,
    '',
    '💰 Giảm:',
    payload.discountText,
    '',
    '📦 Áp dụng:',
    payload.applyScope,
    '',
    '🔥 Chỉ còn:',
    `${payload.remainingUsage} lượt sử dụng`,
    '',
    '⏰ Hết hạn:',
    payload.expiredAt,
    '',
    '━━━━━━━━━━━━━━━━━━',
    '👉 Sử dụng ngay tại trang thanh toán để nhận ưu đãi.',
    '━━━━━━━━━━━━━━━━━━',
    '',
    'AI Store cảm ơn bạn đã đồng hành cùng chúng tôi ❤️',
  ].join('\n');
}
