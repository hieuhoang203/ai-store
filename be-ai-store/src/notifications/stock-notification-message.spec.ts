import {
  renderNewStockNotification,
  renderOutOfStockNotification,
} from './stock-notification-message';

describe('stock notification messages', () => {
  it('renders new stock notification', () => {
    const message = renderNewStockNotification({
      serviceName: 'Cursor Pro',
      categoryName: 'AI Coding',
      variantName: '1 Tháng',
      quantity: 3,
    });

    expect(message).toBe([
      '🚀 HÀNG MỚI VỀ KHO',
      '',
      '🤖 Cursor Pro',
      '📂 AI Coding',
      '📦 1 Tháng',
      '',
      '➕ Vừa cập nhật: 3 tài khoản',
      '',
      '✅ Đã sẵn sàng để đặt mua.',
      '',
      '🛒 Truy cập AI Store để xem chi tiết.',
    ].join('\n'));
  });

  it('renders out-of-stock notification', () => {
    const message = renderOutOfStockNotification({
      serviceName: 'Claude Pro',
      categoryName: 'AI Chat',
      variantName: '1 Tháng',
    });

    expect(message).toBe([
      '📢 HẾT HÀNG',
      '',
      '🤖 Claude Pro',
      '📂 AI Chat',
      '📦 1 Tháng',
      '',
      '🔥 Toàn bộ tài khoản đã được bán hết.',
      '',
      '⏳ Chúng tôi đang bổ sung thêm hàng và sẽ cập nhật sớm nhất.',
    ].join('\n'));
  });
});
