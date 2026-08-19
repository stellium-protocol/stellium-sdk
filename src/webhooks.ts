import * as crypto from "crypto";
import { ValidationError } from "./errors";

/**
 * Represents a webhook event received from the Stellium platform.
 *
 * Webhook events are sent when payments or escrow actions occur, allowing
 * your application to react to on-chain activity in real time.
 */
export interface WebhookEvent {
  /** The event type identifier. */
  type: "payment.created" | "escrow.created" | "escrow.released" | "escrow.refunded";
  /** The unique numeric ID of the payment or escrow that triggered this event. */
  id: number;
  /** Unix timestamp (in seconds) when the event was created. */
  timestamp: number;
  /** Additional event-specific data payload. */
  data: Record<string, unknown>;
}

/**
 * Verify a webhook signature using HMAC-SHA256.
 *
 * Validates that the incoming webhook request was signed by Stellium using
 * your webhook secret. Uses timing-safe comparison to prevent timing attacks.
 *
 * @param payload - Raw request body string (the exact body as received).
 * @param signature - Hex-encoded signature from the `X-Stellium-Signature` header.
 * @param secret - Your webhook secret from the Stellium dashboard.
 * @returns `true` if the signature is valid and matches the payload, `false` otherwise.
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from "@stellium/stellium-sdk";
 *
 * const isValid = verifyWebhookSignature(
 *   request.body,
 *   request.headers["x-stellium-signature"],
 *   "whsec_your_secret_here"
 * );
 *
 * if (!isValid) {
 *   return res.status(401).send("Invalid signature");
 * }
 * ```
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
 *
 * Parses the raw JSON string into a {@link WebhookEvent} object and validates
 * that the required fields (`type`, `id`, `timestamp`) are present.
 *
 * @param payload - Raw JSON string of the webhook request body.
 * @returns A typed {@link WebhookEvent} object.
 * @throws {ValidationError} If the payload is missing required fields (`type`, `id`, `timestamp`).
 * @throws {SyntaxError} If the payload is not valid JSON.
 *
 * @example
 * ```typescript
 * import { parseWebhookEvent, ValidationError } from "@stellium/stellium-sdk";
 *
 * try {
 *   const event = parseWebhookEvent(request.body);
 *
 *   switch (event.type) {
 *     case "payment.created":
 *       console.log(`New payment #${event.id}`);
 *       break;
 *     case "escrow.released":
 *       console.log(`Escrow #${event.id} released`);
 *       break;
 *   }
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     console.error("Invalid webhook payload:", err.message);
 *   }
 * }
 * ```
 */
export function parseWebhookEvent(payload: string): WebhookEvent {
  const event = JSON.parse(payload);

  if (!event.type || !event.id || !event.timestamp) {
    throw new ValidationError(
      "Invalid webhook event: missing required fields",
      "INVALID_WEBHOOK_EVENT"
    );
  }

  return event as WebhookEvent;
}
