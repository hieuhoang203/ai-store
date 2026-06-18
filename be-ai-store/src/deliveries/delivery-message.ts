export type DeliveryAccount = {
  email?: string | null;
  password?: string | null;
};

export type DeliveryProduct = {
  serviceName: string;
  duration?: string | null;
  warrantyDays?: number | null;
  accounts: DeliveryAccount[];
};

export type DeliverySupportContact = {
  telegram?: string | null;
  zalo?: string | null;
  email?: string | null;
};

export type DeliveryMessagePayload = {
  orderCode: string;
  products: DeliveryProduct[];
  support: DeliverySupportContact;
};

export function renderDeliveryMessage(payload: DeliveryMessagePayload) {
  const lines = [
    '🎉 THANH TOÁN THÀNH CÔNG',
    '',
    `Mã đơn hàng: ${renderValue(payload.orderCode)}`,
    '',
    'Cảm ơn bạn đã mua hàng tại AI Store ❤️',
    '',
    ...payload.products.flatMap((product, index) => renderProduct(product, index)),
    '',
    '📞 HỖ TRỢ & BẢO HÀNH',
    '',
    'Telegram:',
    renderValue(payload.support.telegram),
    '',
    'Zalo:',
    renderValue(payload.support.zalo),
    '',
    'Email:',
    renderValue(payload.support.email),
    '',
    '⚠️ LƯU Ý',
    '',
    '• Vui lòng lưu lại thông tin tài khoản',
    '• Không chia sẻ tài khoản cho người khác',
    '• Liên hệ hỗ trợ ngay khi gặp lỗi đăng nhập',
    '• Chính sách bảo hành áp dụng theo từng sản phẩm',
    '',
    'Xin cảm ơn bạn đã tin tưởng sử dụng dịch vụ ❤️',
    '',
    'AI Store Team',
  ];

  return lines.join('\n');
}

function renderProduct(product: DeliveryProduct, index: number) {
  return [
    `📦 SẢN PHẨM ${index + 1}`,
    '',
    `🤖 Dịch vụ: ${renderValue(product.serviceName)}`,
    '',
    `📅 Gói: ${renderValue(product.duration)}`,
    '',
    `🛡️ Bảo hành: ${renderWarranty(product.warrantyDays)}`,
    '',
    ...renderAccounts(product.accounts),
    '',
  ];
}

function renderAccounts(accounts: DeliveryAccount[]) {
  const normalizedAccounts = accounts.length ? accounts : [{}];
  const showAccountTitle = normalizedAccounts.length > 1;

  return normalizedAccounts.flatMap((account, index) => [
    ...(showAccountTitle ? [`Tài khoản #${index + 1}`, ''] : []),
    '📧 Email:',
    renderValue(account.email),
    '',
    '🔑 Password:',
    renderValue(account.password),
    ...(index < normalizedAccounts.length - 1 ? ['', ''] : []),
  ]);
}

function renderWarranty(warrantyDays?: number | null) {
  if (warrantyDays === null || warrantyDays === undefined) {
    return 'Theo chính sách sản phẩm';
  }

  return `${warrantyDays} ngày`;
}

function renderValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}
