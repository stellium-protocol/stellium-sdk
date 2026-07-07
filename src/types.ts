export type Network = "testnet" | "mainnet" | "futurenet";

export interface StelliumConfig {
  /** Stellar network to use */
  network: Network;
  /** Escrow contract address on-chain */
  escrowContractId: string;
  /** Payment contract address on-chain */
  paymentContractId: string;
  /** RPC server URL (auto-selected from network if omitted) */
  rpcUrl?: string;
}

export interface CreatePaymentParams {
  /** Sender's Stellar secret key */
  senderSecretKey: string;
  /** Recipient Stellar address */
  recipient: string;
  /** Amount in stroops (1 XLM = 10,000,000 stroops) */
  amount: string;
  /** Asset contract address (native XLM if omitted) */
  asset?: string;
  /** Optional metadata string */
  metadata?: string;
}

export interface CreateEscrowParams {
  /** Buyer's Stellar secret key */
  buyerSecretKey: string;
  /** Seller Stellar address */
  seller: string;
  /** Amount in stroops */
  amount: string;
  /** Asset contract address */
  asset: string;
  /** Timeout in seconds from now */
  timeoutSeconds: number;
}

export interface EscrowActionParams {
  /** User's Stellar secret key (buyer for release/refund) */
  secretKey: string;
  /** Escrow ID returned from createEscrow */
  escrowId: number;
}

export interface PaymentResult {
  paymentId: number;
  txHash: string;
}

export interface EscrowResult {
  escrowId: number;
  txHash: string;
}

export interface PaymentDetails {
  id: number;
  sender: string;
  recipient: string;
  amount: string;
  asset: string;
  metadata: string;
  completed: boolean;
}

export interface EscrowDetails {
  id: number;
  buyer: string;
  seller: string;
  amount: string;
  asset: string;
  timeout: number;
  released: boolean;
  refunded: boolean;
}
