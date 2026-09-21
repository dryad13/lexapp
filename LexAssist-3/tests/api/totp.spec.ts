import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { generateTotpSecret, verifyTotp, base32Decode } from "../../artifacts/api-server/src/lexassist/totp.ts";

function currentTotp(secretBase32: string): string {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

describe("totp", () => {
  it("verifies a current code", () => {
    const secret = generateTotpSecret();
    const code = currentTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });
});
