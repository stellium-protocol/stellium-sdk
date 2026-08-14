/**
 * @stellium/stellium-sdk
 *
 * TypeScript SDK for Stellium — accept Stellar payments in your app.
 *
 * @example
 * ```typescript
 * import { StelliumClient, stroopsToXlm, verifyWebhookSignature } from "@stellium/stellium-sdk";
 *
 * const client = new StelliumClient({
 *   network: "testnet",
 *   paymentContractId: "CABC123...",
 *   escrowContractId: "CDEF456...",
 * });
 *
 * // Create a payment
 * const result = await client.createPayment({
 *   senderSecretKey: "SABC123...",
 *   recipient: "GXYZ789...",
 *   amount: "10000000",
 * });
 *
 * console.log(stroopsToXlm(result.paymentId));
 * ```
 *
 * @packageDocumentation
 */

export { StelliumClient } from "./client";
export { verifyWebhookSignature, parseWebhookEvent } from "./webhooks";
export { stroopsToXlm, xlmToStroops, isValidStellarAddress } from "./utils";
export type {
  StelliumConfig,
  CreatePaymentParams,
  CreateEscrowParams,
  EscrowActionParams,
  PaymentResult,
  EscrowResult,
  PaymentDetails,
  EscrowDetails,
  Network,
} from "./types";
export type { WebhookEvent } from "./webhooks";
