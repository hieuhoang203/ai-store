export type DeliveryAccount = {
  email?: string | null;
  username?: string | null;
  password?: string | null;
  gatewayUrl?: string | null;
  licenseKey?: string | null;
  apiKey?: string | null;
  voucherCode?: string | null;
  workspace?: string | null;
  type?: string | null;
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
    '✨ AI STORE ĐÃ GIAO DỊCH VỤ ✨',
    '',
    'Cảm ơn bạn đã tin tưởng AI Store. Mình gửi thông tin nhận dịch vụ ngay bên dưới nhé.',
    '',
    `🧾 Mã đơn hàng: ${renderValue(payload.orderCode)}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    ...payload.products.flatMap(renderProduct),
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '🛟 Cần hỗ trợ cứ nhắn mình:',
    `💬 Telegram: ${renderValue(payload.support.telegram)}`,
    `📱 Zalo: ${renderValue(payload.support.zalo)}`,
    '',
    '💚 Chúc bạn sử dụng dịch vụ thật hiệu quả. Cảm ơn bạn đã chọn AI Store!',
  ].join('\n');
}

export function renderDeliveryTelegramMessage(payload: DeliveryMessagePayload) {
  return [
    '✨ <b>AI STORE ĐÃ GIAO DỊCH VỤ</b> ✨',
    '',
    'Cảm ơn bạn đã tin tưởng AI Store. Mình gửi thông tin nhận dịch vụ ngay bên dưới nhé.',
    '',
    `🧾 Mã đơn hàng: <code>${escapeHtml(renderValue(payload.orderCode))}</code>`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    ...payload.products.flatMap(renderTelegramProduct),
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '🛟 <b>Cần hỗ trợ cứ nhắn mình:</b>',
    `💬 Telegram: ${escapeHtml(renderValue(payload.support.telegram))}`,
    `📱 Zalo: ${escapeHtml(renderValue(payload.support.zalo))}`,
    '',
    '💚 <i>Chúc bạn sử dụng dịch vụ thật hiệu quả. Cảm ơn bạn đã chọn AI Store!</i>',
  ].join('\n');
}

function renderProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account, index) => {
    const header = `🎁 ${renderProductName(product)}${accounts.length > 1 ? ` (Phần ${index + 1})` : ''}`;
    if (account.gatewayUrl) {
      return [
        header,
        `🚀 Link nhận dịch vụ: ${renderValue(account.gatewayUrl)}`,
        product.warrantyDays ? `🛡️ Bảo hành: ${product.warrantyDays} ngày` : '',
        '',
      ].filter(Boolean);
    }

    if (account.licenseKey || account.apiKey || account.voucherCode) {
      return [
        header,
        `🔐 Mã kích hoạt: ${renderValue(account.licenseKey || account.apiKey || account.voucherCode)}`,
        product.warrantyDays ? `🛡️ Bảo hành: ${product.warrantyDays} ngày` : '',
        '',
      ].filter(Boolean);
    }

    return [
      header,
      `👤 Tài khoản: ${renderValue(account.email || account.username)}`,
      `🔒 Mật khẩu: ${renderValue(account.password)}`,
      account.workspace ? `🏢 Workspace: ${renderValue(account.workspace)}` : '',
      product.warrantyDays ? `🛡️ Bảo hành: ${product.warrantyDays} ngày` : '',
      '',
    ].filter(Boolean);
  });
}

function renderTelegramProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account, index) => {
    const header = `🎁 <b>${escapeHtml(renderProductName(product))}</b>${accounts.length > 1 ? ` (Phần ${index + 1})` : ''}`;
    if (account.gatewayUrl) {
      return [
        header,
        `🚀 Link nhận dịch vụ: <a href="${escapeHtml(renderValue(account.gatewayUrl))}">Bấm để tham gia ngay</a>`,
        product.warrantyDays ? `🛡️ Bảo hành: <b>${product.warrantyDays} ngày</b>` : '',
        '',
      ].filter(Boolean);
    }

    if (account.licenseKey || account.apiKey || account.voucherCode) {
      return [
        header,
        `🔐 Mã kích hoạt: <code>${escapeHtml(renderValue(account.licenseKey || account.apiKey || account.voucherCode))}</code>`,
        product.warrantyDays ? `🛡️ Bảo hành: <b>${product.warrantyDays} ngày</b>` : '',
        '',
      ].filter(Boolean);
    }

    return [
      header,
      `👤 Tài khoản: <code>${escapeHtml(renderValue(account.email || account.username))}</code>`,
      `🔒 Mật khẩu: <code>${escapeHtml(renderValue(account.password))}</code>`,
      account.workspace ? `🏢 Workspace: <code>${escapeHtml(renderValue(account.workspace))}</code>` : '',
      product.warrantyDays ? `🛡️ Bảo hành: <b>${product.warrantyDays} ngày</b>` : '',
      '',
    ].filter(Boolean);
  });
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
