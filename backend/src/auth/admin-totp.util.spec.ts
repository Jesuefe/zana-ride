import { generateAdminTotpCode, generateAdminTotpSecret, verifyAdminTotpCode } from './admin-totp.util';

describe('admin TOTP utilities', () => {
  it('generates a Base32 secret and verifies a current time-based code', () => {
    const secret = generateAdminTotpSecret();
    const timestamp = 1_800_000_000_000;
    const code = generateAdminTotpCode(secret, timestamp);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyAdminTotpCode(secret, code, timestamp)).toBe(true);
  });

  it('accepts one adjacent 30-second time step for clock drift', () => {
    const secret = generateAdminTotpSecret();
    const timestamp = 1_800_000_000_000;
    const code = generateAdminTotpCode(secret, timestamp);
    expect(verifyAdminTotpCode(secret, code, timestamp + 30_000)).toBe(true);
  });

  it('rejects malformed and incorrect codes', () => {
    const secret = generateAdminTotpSecret();
    expect(verifyAdminTotpCode(secret, '12345')).toBe(false);
    expect(verifyAdminTotpCode(secret, 'abcdef')).toBe(false);
    expect(verifyAdminTotpCode(secret, '000000', 1_800_000_000_000)).toBe(false);
  });
});
