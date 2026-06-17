import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENCRYPTED_PREFIX = 'v1';

@Injectable()
export class InventoryPasswordService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(value: string | null | undefined) {
    if (!value) return value;
    if (this.isEncrypted(value)) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      ENCRYPTED_PREFIX,
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  decrypt(value: string | null | undefined) {
    if (!value || !this.isEncrypted(value)) return value || '';

    const [, ivHex, tagHex, encryptedHex] = value.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private isEncrypted(value: string) {
    return value.startsWith(`${ENCRYPTED_PREFIX}:`);
  }

  private getKey() {
    const secret = this.configService.get<string>('INVENTORY_PASSWORD_SECRET') || 'local-inventory-password-secret';
    return createHash('sha256').update(secret).digest();
  }
}
