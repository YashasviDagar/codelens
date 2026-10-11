import crypto from "node:crypto";

const key = crypto.scryptSync(process.env.ENCRYPTION_KEY ?? "dev", "codelens-token-salt", 32);

export function decryptToken(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(".");
  if (version !== "v1") throw new Error("Unknown token format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf-8");
}
