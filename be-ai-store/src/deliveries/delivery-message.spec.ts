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
      '🎉 ĐẶT HÀNG THÀNH CÔNG',
      '',
      '🧾 Mã đơn: AI178176743658873',
      '',
      '━━━━━━━━━━━━━━',
      '',
      '🤖 Figma (1 Tháng)',
      '📧 figmaprotest@gmail.com',
      '🔑 admin@1234',
      '',
      '━━━━━━━━━━━━━━',
      '',
      '🛠️ Hỗ trợ:',
      '💬 Telegram: @hieuhv203',
      '📱 Zalo: 0966628527',
      '',
      '❤️ AI Store cảm ơn bạn đã tin tưởng sử dụng dịch vụ.',
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

    expect(message).toContain('🤖 ChatGPT Plus (1 Tháng)\n📧 a@gmail.com\n🔑 123');
    expect(message).toContain('🤖 ChatGPT Plus (1 Tháng)\n📧 b@gmail.com\n🔑 456');
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

    expect(message).toContain('🤖 Figma (1 Tháng)\n📧 figma@gmail.com\n🔑 figma-pass');
    expect(message).toContain('🤖 Canva (365 Ngày)\n📧 canva@gmail.com\n🔑 canva-pass');
    expect(message).toContain('💬 Telegram: @hieuhv203');
    expect(message).toContain('📱 Zalo: 0966628527');
    expect(message).not.toContain('Email:');
    expect(message).not.toContain('LƯU Ý');
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

    expect(message).toContain('🧾 Mã đơn: <code>AI178176743658876</code>');
    expect(message).toContain('🤖 Figma &lt;Pro&gt; (1 Tháng)');
    expect(message).toContain('📧 <code>figma&amp;test@gmail.com</code>');
    expect(message).toContain('🔑 <code>admin&lt;1234&gt;</code>');
  });
});
