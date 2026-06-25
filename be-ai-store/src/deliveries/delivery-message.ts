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
    '🎉 ĐẶT HÀNG THÀNH CÔNG 🎉',
    '',
    `💳 Mã đơn hàng: ${renderValue(payload.orderCode)}`,
    '',
    '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    '',
    ...payload.products.flatMap(renderProduct),
    '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    '',
    '☎️ Kênh hỗ trợ:',
    `✈️ Telegram: ${renderValue(payload.support.telegram)}`,
    `💬 Zalo: ${renderValue(payload.support.zalo)}`,
    '',
    '❤️ AI Store chân thành cảm ơn bạn đã tin tưởng sử dụng dịch vụ!',
  ].join('\n');
}

export function renderDeliveryTelegramMessage(payload: DeliveryMessagePayload) {
  return [
    '🎉 <b>ĐẶT HÀNG THÀNH CÔNG</b> 🎉',
    '',
    `💳 Mã đơn hàng: <code>${escapeHtml(renderValue(payload.orderCode))}</code>`,
    '',
    '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    '',
    ...payload.products.flatMap(renderTelegramProduct),
    '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    '',
    '☎️ <b>Kênh hỗ trợ:</b>',
    `✈️ Telegram: ${escapeHtml(renderValue(payload.support.telegram))}`,
    `💬 Zalo: ${escapeHtml(renderValue(payload.support.zalo))}`,
    '',
    '❤️ <i>AI Store chân thành cảm ơn bạn đã tin tưởng sử dụng dịch vụ!</i>',
  ].join('\n');
}

function renderProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account, index) => {
    const header = `📦 ${renderProductName(product)}${accounts.length > 1 ? ` (Phần ${index + 1})` : ''}`;
    if (account.gatewayUrl) {
      return [
        header,
        `🔗 Link nhận dịch vụ: ${renderValue(account.gatewayUrl)}`,
        '',
      ];
    }

    if (account.licenseKey || account.apiKey || account.voucherCode) {
      return [
        header,
        `🔑 Mã kích hoạt: ${renderValue(account.licenseKey || account.apiKey || account.voucherCode)}`,
        '',
      ];
    }

    return [
      header,
      `👤 Tài khoản: ${renderValue(account.email || account.username)}`,
      `🔒 Mật khẩu: ${renderValue(account.password)}`,
      account.workspace ? `💼 Workspace: ${renderValue(account.workspace)}` : '',
      '',
    ].filter(Boolean);
  });
}

function renderTelegramProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account, index) => {
    const header = `📦 <b>${escapeHtml(renderProductName(product))}</b>${accounts.length > 1 ? ` (Phần ${index + 1})` : ''}`;
    if (account.gatewayUrl) {
      return [
        header,
        `🔗 Link nhận dịch vụ: <a href="${escapeHtml(renderValue(account.gatewayUrl))}">Tham gia ngay</a>`,
        '',
      ];
    }

    if (account.licenseKey || account.apiKey || account.voucherCode) {
      return [
        header,
        `🔑 Mã kích hoạt: <code>${escapeHtml(renderValue(account.licenseKey || account.apiKey || account.voucherCode))}</code>`,
        '',
      ];
    }

    return [
      header,
      `👤 Tài khoản: <code>${escapeHtml(renderValue(account.email || account.username))}</code>`,
      `🔒 Mật khẩu: <code>${escapeHtml(renderValue(account.password))}</code>`,
      account.workspace ? `💼 Workspace: <code>${escapeHtml(renderValue(account.workspace))}</code>` : '',
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
