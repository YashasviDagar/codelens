import { describe, it, expect } from "vitest";
import { verifyWebhookSignature, signPayload } from "../packages/github/src/webhook-signature";

const SECRET = "test-secret";
const BODY = JSON.stringify({ action: "opened", number: 1 });

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload (string and Buffer)", () => {
    const sig = signPayload(BODY, SECRET);
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from(BODY), sig, SECRET)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const sig = signPayload(BODY, SECRET);
    expect(verifyWebhookSignature(BODY.replace("opened", "closed"), sig, SECRET)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature(BODY, signPayload(BODY, "other"), SECRET)).toBe(false);
  });

  it("rejects missing, malformed or wrong-length headers", () => {
    expect(verifyWebhookSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "sha1=abc", SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "sha256=abc", SECRET)).toBe(false);
  });
});
