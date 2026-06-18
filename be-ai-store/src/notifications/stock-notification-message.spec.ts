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

    expect(message).toContain('🚀 HÀNG MỚI ĐÃ CẬP BẾN TẠI AI STORE');
    expect(message).toContain('🤖 Dịch vụ: Cursor Pro');
    expect(message).toContain('AI Coding');
    expect(message).toContain('1 Tháng');
    expect(message).toContain('3 tài khoản');
  });

  it('renders out-of-stock notification', () => {
    const message = renderOutOfStockNotification({
      serviceName: 'Claude Pro',
      categoryName: 'AI Chat',
      variantName: '1 Tháng',
    });

    expect(message).toContain('📢 THÔNG BÁO HẾT HÀNG');
    expect(message).toContain('🤖 Dịch vụ: Claude Pro');
    expect(message).toContain('AI Chat');
    expect(message).toContain('1 Tháng');
    expect(message).toContain('AI Store Team');
  });
});
