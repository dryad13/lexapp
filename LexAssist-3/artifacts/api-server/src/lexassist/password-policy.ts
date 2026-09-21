import crypto from "crypto";

export type PasswordValidation = { ok: true } | { ok: false; error: string };

/** Min 12 chars, at least one letter and one digit. */
export function validatePassword(password: string): PasswordValidation {
  if (!password || typeof password !== "string") {
    return { ok: false, error: "Password is required" };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be at least 12 characters" };
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: "Password must include at least one letter and one digit" };
  }
  return { ok: true };
}

/** Cryptographically random temp password that always satisfies validatePassword. */
export function generateTempPassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const bytes = crypto.randomBytes(Math.max(length, 12));
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  if (!/[A-Za-z]/.test(out)) out = "A" + out.slice(1);
  if (!/\d/.test(out)) out = out.slice(0, -1) + "7";
  return out;
}
