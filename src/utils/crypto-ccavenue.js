import crypto from "node:crypto";

// CCAvenue encrypts its response/notification payloads with AES-128-CBC where:
//   key = MD5(workingKey)  (16 raw bytes)
//   iv  = 0x00..0x0f       (fixed 16 bytes)
//   ciphertext is hex-encoded, PKCS#7 padding (Node's default for aes-128-cbc)
// This matches CCAvenue's official Node/PHP/Java sample code.

const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
  0x0d, 0x0e, 0x0f,
]);

function keyFromWorkingKey(workingKey) {
  return crypto.createHash("md5").update(workingKey).digest(); // 16 bytes
}

export function decryptCCAvenue(encResponseHex, workingKey) {
  if (!encResponseHex) throw new Error("empty encResp");
  if (!workingKey) throw new Error("CCAvenue working key not configured");
  const key = keyFromWorkingKey(workingKey);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, IV);
  let decoded = decipher.update(String(encResponseHex).trim(), "hex", "utf8");
  decoded += decipher.final("utf8");
  return decoded; // e.g. "order_id=...&order_status=Success&billing_email=..."
}

// Only used by tests to produce a valid encResp without needing a real payload.
export function encryptCCAvenue(plaintext, workingKey) {
  const key = keyFromWorkingKey(workingKey);
  const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
  let enc = cipher.update(String(plaintext), "utf8", "hex");
  enc += cipher.final("hex");
  return enc;
}
