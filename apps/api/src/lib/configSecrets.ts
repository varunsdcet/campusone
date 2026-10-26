import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key() {
  const configured = process.env.CONFIG_ENCRYPTION_KEY;
  if (!configured || configured.length < 32) {
    throw Object.assign(new Error("CONFIG_ENCRYPTION_KEY must be set to at least 32 characters before saving secrets"), {
      status: 503,
      code: "SECRET_ENCRYPTION_NOT_CONFIGURED",
    });
  }
  return createHash("sha256").update(configured).digest();
}

export function encryptConfigSecret(value: string) {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decryptConfigSecret(value: string) {
  if (!value || !value.startsWith(PREFIX)) return value;
  const packed = Buffer.from(value.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
}

export function isEncryptedConfigSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}
