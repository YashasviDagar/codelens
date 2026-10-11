import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for stored GitHub tokens.
 * Key derived from ENCRYPTION_KEY via scrypt.
 */
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY ?? "dev", "codelens-token-salt", 32);

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptToken(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(".");
  if (version !== "v1") throw new Error("Unknown token format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf-8");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
