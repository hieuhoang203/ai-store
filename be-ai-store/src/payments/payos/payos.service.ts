import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CreatePayosPaymentLinkInput,
  PayosPaymentLinkData,
  PayosPaymentLinkStatusData,
  PayosWebhookBody,
} from './payos.types';

type PayosApiResponse<T> = {
  code: string;
  desc: string;
  data?: T;
  signature?: string;
};

@Injectable()
export class PayosService {
  private readonly apiBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiBaseUrl = this.configService.get<string>('PAYOS_API_BASE_URL') || 'https://api-merchant.payos.vn';
  }

  async createPaymentLink(input: CreatePayosPaymentLinkInput): Promise<PayosPaymentLinkData> {
    const clientId = this.getRequiredConfig('PAYOS_CLIENT_ID');
    const apiKey = this.getRequiredConfig('PAYOS_API_KEY');
    const body = {
      ...input,
      signature: this.signPaymentRequest(input),
    };

    const response = await fetch(`${this.apiBaseUrl}/v2/payment-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as PayosApiResponse<PayosPaymentLinkData> | null;

    if (!response.ok || !payload || payload.code !== '00' || !payload.data) {
      throw new BadGatewayException(payload?.desc || 'Cannot create payOS payment link');
    }

    return payload.data;
  }

  async getPaymentLink(orderCode: number): Promise<PayosPaymentLinkStatusData> {
    const clientId = this.getRequiredConfig('PAYOS_CLIENT_ID');
    const apiKey = this.getRequiredConfig('PAYOS_API_KEY');
    const response = await fetch(`${this.apiBaseUrl}/v2/payment-requests/${orderCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-key': apiKey,
      },
    });

    const payload = (await response.json().catch(() => null)) as PayosApiResponse<PayosPaymentLinkStatusData> | null;

    if (!response.ok || !payload || payload.code !== '00' || !payload.data) {
      throw new BadGatewayException(payload?.desc || 'Cannot get payOS payment link');
    }

    return payload.data;
  }

  verifyWebhook(body: PayosWebhookBody) {
    if (!body?.data || !body.signature) {
      throw new UnauthorizedException('Invalid payOS webhook payload');
    }

    const expectedSignature = this.signWebhookData(body.data);
    if (!this.safeEqual(expectedSignature, body.signature)) {
      throw new UnauthorizedException('Invalid payOS webhook signature');
    }

    return body.data;
  }

  private signPaymentRequest(input: CreatePayosPaymentLinkInput) {
    const data = [
      `amount=${input.amount}`,
      `cancelUrl=${input.cancelUrl}`,
      `description=${input.description}`,
      `orderCode=${input.orderCode}`,
      `returnUrl=${input.returnUrl}`,
    ].join('&');

    return this.hmac(data);
  }

  private signWebhookData(data: Record<string, unknown>) {
    const sorted = Object.keys(data)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = data[key];
        return result;
      }, {});

    const query = Object.keys(sorted)
      .filter((key) => sorted[key] !== undefined)
      .map((key) => {
        const value = sorted[key];
        if (Array.isArray(value)) {
          return `${key}=${JSON.stringify(value.map((item) => this.sortObject(item)))}`;
        }
        if (value === null || value === undefined || value === 'undefined' || value === 'null') {
          return `${key}=`;
        }
        return `${key}=${String(value)}`;
      })
      .join('&');

    return this.hmac(query);
  }

  private sortObject(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = (value as Record<string, unknown>)[key];
        return result;
      }, {});
  }

  private hmac(data: string) {
    return createHmac('sha256', this.getRequiredConfig('PAYOS_CHECKSUM_KEY'))
      .update(data)
      .digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new BadGatewayException(`${key} is not configured`);
    }
    return value;
  }
}
