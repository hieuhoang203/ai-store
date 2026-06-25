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
    'DAT HANG THANH CONG',
    '',
    `Ma don: ${renderValue(payload.orderCode)}`,
    '',
    '------------------------------',
    '',
    ...payload.products.flatMap(renderProduct),
    '------------------------------',
    '',
    'Ho tro:',
    `Telegram: ${renderValue(payload.support.telegram)}`,
    `Zalo: ${renderValue(payload.support.zalo)}`,
    '',
    'AI Store cam on ban da tin tuong su dung dich vu.',
  ].join('\n');
}

export function renderDeliveryTelegramMessage(payload: DeliveryMessagePayload) {
  return [
    'DAT HANG THANH CONG',
    '',
    `Ma don: <code>${escapeHtml(renderValue(payload.orderCode))}</code>`,
    '',
    '------------------------------',
    '',
    ...payload.products.flatMap(renderTelegramProduct),
    '------------------------------',
    '',
    'Ho tro:',
    `Telegram: ${escapeHtml(renderValue(payload.support.telegram))}`,
    `Zalo: ${escapeHtml(renderValue(payload.support.zalo))}`,
    '',
    'AI Store cam on ban da tin tuong su dung dich vu.',
  ].join('\n');
}

function renderProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account) => {
    if (account.gatewayUrl) {
      return [
        renderProductName(product),
        `Link nhan dich vu: ${renderValue(account.gatewayUrl)}`,
        '',
      ];
    }

    if (account.licenseKey || account.apiKey || account.voucherCode) {
      return [
        renderProductName(product),
        `Ma: ${renderValue(account.licenseKey || account.apiKey || account.voucherCode)}`,
        '',
      ];
    }

    return [
      renderProductName(product),
      `Email/User: ${renderValue(account.email || account.username)}`,
      `Password: ${renderValue(account.password)}`,
      account.workspace ? `Workspace: ${renderValue(account.workspace)}` : '',
      '',
    ].filter(Boolean);
  });
}

function renderTelegramProduct(product: DeliveryProduct) {
  const accounts = product.accounts.length ? product.accounts : [{}];

  return accounts.flatMap((account) => {
    if (account.gatewayUrl) {
      return [
        escapeHtml(renderProductName(product)),
        `Link nhan dich vu: ${escapeHtml(renderValue(account.gatewayUrl))}`,
        '',
      ];
    }

    if (account.licenseKey || account.apiKey || account.voucherCode) {
      return [
        escapeHtml(renderProductName(product)),
        `Ma: <code>${escapeHtml(renderValue(account.licenseKey || account.apiKey || account.voucherCode))}</code>`,
        '',
      ];
    }

    return [
      escapeHtml(renderProductName(product)),
      `Email/User: <code>${escapeHtml(renderValue(account.email || account.username))}</code>`,
      `Password: <code>${escapeHtml(renderValue(account.password))}</code>`,
      account.workspace ? `Workspace: ${escapeHtml(renderValue(account.workspace))}` : '',
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
