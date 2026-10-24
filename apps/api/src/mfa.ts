import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const key = () => {
  const raw = process.env.MFA_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error("MFA_ENCRYPTION_KEY must contain 64 hexadecimal characters (32 bytes).");
  return Buffer.from(raw, "hex");
};

export function newTotpSecret() { return base32Encode(randomBytes(20)); }
export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptTotpSecret(value: string) {
  const [ivPart, tagPart, ciphertextPart] = value.split(".");
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error("Stored MFA secret is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextPart, "base64url")), decipher.final()]).toString("utf8");
}
export function isTotpCodeValid(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const secretBytes = base32Decode(secret); const timeStep = Math.floor(now / 30_000);
  for (const step of [timeStep - 1, timeStep, timeStep + 1]) {
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
    const digest = createHmac("sha1", secretBytes).update(counter).digest(); const offset = digest[digest.length - 1]! & 0x0f;
    const binary = ((digest[offset]! & 0x7f) << 24) | ((digest[offset + 1]! & 0xff) << 16) | ((digest[offset + 2]! & 0xff) << 8) | (digest[offset + 3]! & 0xff);
    const expected = String(binary % 1_000_000).padStart(6, "0");
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}
export function totpUri(email: string, secret: string) {
  const label = encodeURIComponent(`NOORA:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=NOORA&algorithm=SHA1&digits=6&period=30`;
}
function base32Encode(buffer: Buffer) {
  let bits = 0; let value = 0; let output = "";
  for (const byte of buffer) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(input: string) {
  let bits = 0; let value = 0; const output: number[] = [];
  for (const char of input.toUpperCase().replace(/=+$/, "")) {
    const index = alphabet.indexOf(char); if (index < 0) throw new Error("MFA secret is invalid.");
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}
