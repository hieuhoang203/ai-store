import { ConfigService } from '@nestjs/config';
import { InventoryPasswordService } from './inventory-password.service';

describe('InventoryPasswordService', () => {
  let service: InventoryPasswordService;

  beforeEach(() => {
    service = new InventoryPasswordService({
      get: (key: string) => (key === 'INVENTORY_PASSWORD_SECRET' ? 'unit-test-secret' : undefined),
    } as ConfigService);
  });

  it('encrypts and decrypts inventory passwords', () => {
    const encrypted = service.encrypt('P@ssw0rd<>&');

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toBe('P@ssw0rd<>&');
    expect(service.decrypt(encrypted)).toBe('P@ssw0rd<>&');
  });

  it('does not encrypt an already encrypted value again', () => {
    const encrypted = service.encrypt('secret');

    expect(service.encrypt(encrypted)).toBe(encrypted);
  });

  it('returns plaintext legacy passwords as-is', () => {
    expect(service.decrypt('legacy-password')).toBe('legacy-password');
  });
});
