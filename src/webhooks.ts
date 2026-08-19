import * as crypto from "crypto";

export interface WebhookEvent {
  type: "payment.created" | "escrow.created" | "escrow.released" | "escrow.refunded";
  id: number;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Verify a webhook signature using HMAC-SHA256.
 *
 * @param payload - Raw request body string
 * @param signature - Signature from the `X-Stellium-Signature` header
 * @param secret - Your webhook secret from the Stellium dashboard
 * @returns true if the signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Parse and validate a webhook event payload.
 */
export function parseWebhookEvent(payload: string): WebhookEvent {
  const event = JSON.parse(payload);

  if (!event.type || !event.id || !event.timestamp) {
    throw new Error("Invalid webhook event: missing required fields");
  }

  return event as WebhookEvent;
}
