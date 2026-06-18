import { renderDeliveryMessage, type DeliveryMessagePayload } from './delivery-message';

const support = {
  telegram: '@aistore_support',
  zalo: '0900000000',
  email: 'support@aistore.vn',
};

describe('renderDeliveryMessage', () => {
  it('renders one product with one account', () => {
    const message = renderDeliveryMessage({
      orderCode: 'AI202608170001',
      support,
      products: [
        {
          serviceName: 'ChatGPT Plus',
          duration: '1 Tháng',
          warrantyDays: 30,
          accounts: [{ email: 'abc@gmail.com', password: '123456' }],
        },
      ],
    });

    expect(message).toContain('🎉 THANH TOÁN THÀNH CÔNG');
    expect(message).toContain('Mã đơn hàng: AI202608170001');
    expect(message).toContain('📦 SẢN PHẨM 1');
    expect(message).toContain('🤖 Dịch vụ: ChatGPT Plus');
    expect(message).toContain('📅 Gói: 1 Tháng');
    expect(message).toContain('🛡️ Bảo hành: 30 ngày');
    expect(message).toContain('📧 Email:\nabc@gmail.com');
    expect(message).toContain('🔑 Password:\n123456');
    expect(message).not.toContain('Tài khoản #1');
  });

  it('renders one product with multiple accounts', () => {
    const message = renderDeliveryMessage({
      orderCode: 'AI202608170002',
      support,
      products: [
        {
          serviceName: 'ChatGPT Plus',
          duration: '1 Tháng',
          warrantyDays: 30,
          accounts: [
            { email: 'a@gmail.com', password: '123' },
            { email: 'b@gmail.com', password: '456' },
            { email: 'c@gmail.com', password: '789' },
          ],
        },
      ],
    });

    expect(message).toContain('📦 SẢN PHẨM 1');
    expect(message).toContain('Tài khoản #1');
    expect(message).toContain('Tài khoản #2');
    expect(message).toContain('Tài khoản #3');
    expect(message).toContain('📧 Email:\na@gmail.com');
    expect(message).toContain('📧 Email:\nb@gmail.com');
    expect(message).toContain('📧 Email:\nc@gmail.com');
  });

  it('renders multiple products with multiple accounts', () => {
    const payload: DeliveryMessagePayload = {
      orderCode: 'AI202608170003',
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
        {
          serviceName: 'Claude Pro',
          duration: '1 Tháng',
          warrantyDays: 30,
          accounts: [{ email: 'c@gmail.com', password: '789' }],
        },
        {
          serviceName: 'Cursor Pro',
          duration: '1 Tháng',
          warrantyDays: 15,
          accounts: [{ email: 'd@gmail.com', password: '000' }],
        },
      ],
    };

    const message = renderDeliveryMessage(payload);

    expect(message).toContain('📦 SẢN PHẨM 1');
    expect(message).toContain('🤖 Dịch vụ: ChatGPT Plus');
    expect(message).toContain('📦 SẢN PHẨM 2');
    expect(message).toContain('🤖 Dịch vụ: Claude Pro');
    expect(message).toContain('📦 SẢN PHẨM 3');
    expect(message).toContain('🤖 Dịch vụ: Cursor Pro');
    expect(message).toContain('📞 HỖ TRỢ & BẢO HÀNH');
    expect(message).toContain('Telegram:\n@aistore_support');
    expect(message).toContain('Zalo:\n0900000000');
    expect(message).toContain('Email:\nsupport@aistore.vn');
    expect(message).toContain('⚠️ LƯU Ý');
  });
});
