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
  return [
    '🎉 ĐẶT HÀNG THÀNH CÔNG',
    '',
    `🧾 Mã đơn: ${renderValue(payload.orderCode)}`,
    '',
    '━━━━━━━━━━━━━━',
    '',
    ...payload.products.flatMap(renderProduct),
    '━━━━━━━━━━━━━━',
    '',
    '🛠️ Hỗ trợ:',
    `💬 Telegram: ${renderValue(payload.support.telegram)}`,
    `📱 Zalo: ${renderValue(payload.support.zalo)}`,
    '',
    '❤️ AI Store cảm ơn bạn đã tin tưởng sử dụng dịch vụ.',
  ].join('\n');
}

export function renderDeliveryTelegramMessage(payload: DeliveryMessagePayload) {
  return [
    '🎉 ĐẶT HÀNG THÀNH CÔNG',
    '',
    `🧾 Mã đơn: <code>${escapeHtml(renderValue(payload.orderCode))}</code>`,
    '',
    '━━━━━━━━━━━━━━',
    '',
    ...payload.products.flatMap(renderTelegramProduct),
    '━━━━━━━━━━━━━━',
    '',
    '🛠️ Hỗ trợ:',
    `💬 Telegram: ${escapeHtml(renderValue(payload.support.telegram))}`,
    `📱 Zalo: ${escapeHtml(renderValue(payload.support.zalo))}`,
    '',
    '❤️ AI Store cảm ơn bạn đã tin tưởng sử dụng dịch vụ.',
  ].join('\n');
}

function renderProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account) => [
    `🤖 ${renderProductName(product)}`,
    `📧 ${renderValue(account.email)}`,
    `🔑 ${renderValue(account.password)}`,
    '',
  ]);
}

function renderTelegramProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account) => [
    `🤖 ${escapeHtml(renderProductName(product))}`,
    `📧 <code>${escapeHtml(renderValue(account.email))}</code>`,
    `🔑 <code>${escapeHtml(renderValue(account.password))}</code>`,
    '',
  ]);
}

function renderProductName(product: DeliveryProduct) {
  const duration = renderValue(product.duration);
  if (duration === '-') {
    return renderValue(product.serviceName);
  }

  return `${renderValue(product.serviceName)} (${duration})`;
}

function renderValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
