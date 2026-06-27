import {
  renderDeliveryMessage,
  renderDeliveryTelegramMessage,
  type DeliveryMessagePayload,
} from './delivery-message';

const support = {
  telegram: '@hieuhv203',
  zalo: '0966628527',
  email: 'support@aistore.vn',
};

describe('renderDeliveryMessage', () => {
  it('renders one product with one account', () => {
    const message = renderDeliveryMessage({
      orderCode: 'AI178176743658873',
      support,
      products: [
        {
          serviceName: 'Figma',
          duration: '1 Tháng',
          warrantyDays: 30,
          accounts: [{ email: 'figmaprotest@gmail.com', password: 'admin@1234' }],
        },
      ],
    });

    expect(message).toBe([
      '🎉 ĐẶT HÀNG THÀNH CÔNG 🎉',
      '',
      '💳 Mã đơn hàng: AI178176743658873',
      '',
      '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
      '',
      '📦 Figma (1 Tháng)',
      '👤 Tài khoản: figmaprotest@gmail.com',
      '🔒 Mật khẩu: admin@1234',
      '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
      '',
      '☎️ Kênh hỗ trợ:',
      '✈️ Telegram: @hieuhv203',
      '💬 Zalo: 0966628527',
      '',
      '❤️ AI Store chân thành cảm ơn bạn đã tin tưởng sử dụng dịch vụ!',
    ].join('\n'));
  });

  it('renders one product with multiple accounts', () => {
    const message = renderDeliveryMessage({
      orderCode: 'AI178176743658874',
      support,
      products: [
        {
          serviceName: 'ChatGPT Plus',
          duration: '1 Tháng',
          warrantyDays: 30,
          accounts: [
            { email: 'a@gmail.com', password: '123' },
            { email: 'b@gmail.com', password: '456' },
          ],
        },
      ],
    });

    expect(message).toContain('📦 ChatGPT Plus (1 Tháng) (Phần 1)\n👤 Tài khoản: a@gmail.com\n🔒 Mật khẩu: 123');
    expect(message).toContain('📦 ChatGPT Plus (1 Tháng) (Phần 2)\n👤 Tài khoản: b@gmail.com\n🔒 Mật khẩu: 456');
  });

  it('renders multiple products with multiple accounts', () => {
    const payload: DeliveryMessagePayload = {
      orderCode: 'AI178176743658875',
      support,
      products: [
        {
          serviceName: 'Figma',
          duration: '1 Tháng',
          warrantyDays: 30,
          accounts: [{ email: 'figma@gmail.com', password: 'figma-pass' }],
        },
        {
          serviceName: 'Canva',
          duration: '365 Ngày',
          warrantyDays: 30,
          accounts: [{ email: 'canva@gmail.com', password: 'canva-pass' }],
        },
      ],
    };

    const message = renderDeliveryMessage(payload);

    expect(message).toContain('📦 Figma (1 Tháng)\n👤 Tài khoản: figma@gmail.com\n🔒 Mật khẩu: figma-pass');
    expect(message).toContain('📦 Canva (365 Ngày)\n👤 Tài khoản: canva@gmail.com\n🔒 Mật khẩu: canva-pass');
    expect(message).toContain('✈️ Telegram: @hieuhv203');
    expect(message).toContain('💬 Zalo: 0966628527');
  });

  it('renders telegram message with copyable account credentials', () => {
    const message = renderDeliveryTelegramMessage({
      orderCode: 'AI178176743658876',
      support,
      products: [
        {
          serviceName: 'Figma <Pro>',
          duration: '1 Tháng',
          warrantyDays: 30,
          accounts: [{ email: 'figma&test@gmail.com', password: 'admin<1234>' }],
        },
      ],
    });

    expect(message).toContain('💳 Mã đơn hàng: <code>AI178176743658876</code>');
    expect(message).toContain('📦 <b>Figma &lt;Pro&gt; (1 Tháng)</b>');
    expect(message).toContain('👤 Tài khoản: <code>figma&amp;test@gmail.com</code>');
    expect(message).toContain('🔒 Mật khẩu: <code>admin&lt;1234&gt;</code>');
  });
});
