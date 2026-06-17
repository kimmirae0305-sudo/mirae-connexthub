import crypto from "crypto";

const TOKEN_ENCRYPTION_ALGORITHM = "aes-256-gcm";

function parseEncryptionKey(value?: string | null): Buffer | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) return utf8;

  return null;
}

export function getEmailTokenEncryptionKeyStatus() {
  return {
    isValid: Boolean(parseEncryptionKey(process.env.EMAIL_TOKEN_ENCRYPTION_KEY)),
  };
}

function getEmailTokenEncryptionKey() {
  const key = parseEncryptionKey(process.env.EMAIL_TOKEN_ENCRYPTION_KEY);
  if (!key) {
    throw new Error("Email token encryption is not configured.");
  }
  return key;
}

export function encryptEmailToken(token: string) {
  const key = getEmailTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(TOKEN_ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptEmailToken(encryptedToken: string) {
  const key = getEmailTokenEncryptionKey();
  const [version, ivValue, tagValue, encryptedValue] = String(encryptedToken || "").split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted email token format.");
  }

  const decipher = crypto.createDecipheriv(
    TOKEN_ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
