import { renderCouponNotification } from './coupon-notification-message';

describe('coupon notification messages', () => {
  it('renders new coupon notification', () => {
    const message = renderCouponNotification({
      couponCode: 'SUMMER50',
      discountText: '50%\nTối đa 100.000đ',
      applyScope: 'Tất cả sản phẩm',
      remainingUsage: '20',
      expiredAt: '30/06/2026 23:59',
    });

    expect(message).toBe([
      '🚨 VOUCHER MỚI ĐÃ PHÁT HÀNH',
      '',
      '🎫 Mã: SUMMER50',
      '',
      '💰 Giảm:',
      '50%\nTối đa 100.000đ',
      '',
      '📦 Áp dụng:',
      'Tất cả sản phẩm',
      '',
      '🔥 Chỉ còn:',
      '20 lượt sử dụng',
      '',
      '⏰ Hết hạn:',
      '30/06/2026 23:59',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '👉 Sử dụng ngay tại trang thanh toán để nhận ưu đãi.',
      '━━━━━━━━━━━━━━━━━━',
      '',
      'AI Store cảm ơn bạn đã đồng hành cùng chúng tôi ❤️',
    ].join('\n'));
  });
});
