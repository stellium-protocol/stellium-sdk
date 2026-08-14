/**
 * Supported Stellar network identifiers.
 *
 * - `"testnet"` — Stellar's public test network for development and testing.
 * - `"mainnet"` — Stellar's production main network.
 * - `"futurenet"` — Stellar's experimental future network for preview features.
 */
export type Network = "testnet" | "mainnet" | "futurenet";

/**
 * Configuration for creating a {@link StelliumClient} instance.
 */
export interface StelliumConfig {
  /** Stellar network to use (`"testnet"`, `"mainnet"`, or `"futurenet"`). */
  network: Network;
  /** Escrow contract address deployed on-chain (starts with `C`). */
  escrowContractId: string;
  /** Payment contract address deployed on-chain (starts with `C`). */
  paymentContractId: string;
  /** Custom Soroban RPC server URL. If omitted, the default public RPC for the selected network is used. */
  rpcUrl?: string;
}

/**
 * Parameters for creating a direct payment via {@link StelliumClient.createPayment}.
 */
export interface CreatePaymentParams {
  /** Sender's Stellar secret key (starts with `S`). Used to sign the transaction. */
  senderSecretKey: string;
  /** Recipient's Stellar public key address (starts with `G`). */
  recipient: string;
  /** Payment amount in stroops (1 XLM = 10,000,000 stroops). */
  amount: string;
  /** Soroban asset contract address. Defaults to native XLM if omitted. */
  asset?: string;
  /** Optional UTF-8 metadata string attached to the payment (e.g., order ID, memo). */
  metadata?: string;
}

/**
 * Parameters for creating an escrow via {@link StelliumClient.createEscrow}.
 */
export interface CreateEscrowParams {
  /** Buyer's Stellar secret key (starts with `S`). The buyer's funds are locked in escrow. */
  buyerSecretKey: string;
  /** Seller's Stellar public key address (starts with `G`). Receives funds upon release. */
  seller: string;
  /** Escrow amount in stroops (1 XLM = 10,000,000 stroops). */
  amount: string;
  /** Soroban asset contract address for the escrowed asset. */
  asset: string;
  /** Timeout period in seconds. After this duration, the escrow becomes refundable. */
  timeoutSeconds: number;
}

/**
 * Parameters for escrow actions (release or refund) via {@link StelliumClient.releaseEscrow} or {@link StelliumClient.refundEscrow}.
 */
export interface EscrowActionParams {
  /** Stellar secret key of the user performing the action (buyer for release/refund). */
  secretKey: string;
  /** Numeric escrow ID as returned by {@link StelliumClient.createEscrow}. */
  escrowId: number;
}

/**
 * Result returned after successfully creating a payment.
 */
export interface PaymentResult {
  /** The on-chain payment ID (currently a placeholder; will be parsed from transaction events). */
  paymentId: number;
  /** The hash of the submitted Stellar transaction. */
  txHash: string;
}

/**
 * Result returned after successfully creating an escrow.
 */
export interface EscrowResult {
  /** The on-chain escrow ID (currently a placeholder; will be parsed from transaction events). */
  escrowId: number;
  /** The hash of the submitted Stellar transaction. */
  txHash: string;
}

/**
 * Detailed information about a payment read from the payment contract.
 */
export interface PaymentDetails {
  /** The on-chain payment ID. */
  id: number;
  /** Stellar public key address of the payment sender. */
  sender: string;
  /** Stellar public key address of the payment recipient. */
  recipient: string;
  /** Payment amount as a string (in stroops). */
  amount: string;
  /** Soroban asset contract address used for the payment. */
  asset: string;
  /** UTF-8 metadata string attached to the payment. */
  metadata: string;
  /** Whether the payment has been completed. */
  completed: boolean;
}

/**
 * Detailed information about an escrow read from the escrow contract.
 */
export interface EscrowDetails {
  /** The on-chain escrow ID. */
  id: number;
  /** Stellar public key address of the buyer. */
  buyer: string;
  /** Stellar public key address of the seller. */
  seller: string;
  /** Escrow amount as a string (in stroops). */
  amount: string;
  /** Soroban asset contract address for the escrowed asset. */
  asset: string;
  /** Unix timestamp when the escrow timeout expires. */
  timeout: number;
  /** Whether the escrow has been released to the seller. */
  released: boolean;
  /** Whether the escrow has been refunded to the buyer. */
  refunded: boolean;
}
