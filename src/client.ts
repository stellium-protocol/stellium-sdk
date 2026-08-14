import {
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
  Account,
  Address,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import type {
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
import { getRpcUrl } from "./utils";

const NETWORK_PASSPHRASES: Record<Network, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
  futurenet: Networks.FUTURENET,
};

/**
 * Main client for interacting with the Stellium payment and escrow contracts on Stellar/Soroban.
 *
 * Provides methods to create payments, manage escrows, and query on-chain state.
 * Uses Soroban RPC to submit and simulate transactions against deployed smart contracts.
 *
 * @example
 * ```typescript
 * const client = new StelliumClient({
 *   network: "testnet",
 *   paymentContractId: "CABC123...",
 *   escrowContractId: "CDEF456...",
 * });
 *
 * // Create a direct payment
 * const result = await client.createPayment({
 *   senderSecretKey: "SABC123...",
 *   recipient: "GXYZ789...",
 *   amount: "10000000", // 1 XLM in stroops
 * });
 * console.log("Payment tx hash:", result.txHash);
 * ```
 */
export class StelliumClient {
  private server: SorobanRpc.Server;
  private networkPassphrase: string;
  private escrowContractId: string;
  private paymentContractId: string;

  /**
   * Create a new StelliumClient instance.
   *
   * @param config - Configuration object specifying the network, contract IDs, and optional RPC URL.
   * @throws {Error} If the provided network is not a valid {@link Network} value.
   *
   * @example
   * ```typescript
   * // Basic usage with testnet
   * const client = new StelliumClient({
   *   network: "testnet",
   *   paymentContractId: "CABC123...",
   *   escrowContractId: "CDEF456...",
   * });
   *
   * // With custom RPC URL
   * const client = new StelliumClient({
   *   network: "testnet",
   *   paymentContractId: "CABC123...",
   *   escrowContractId: "CDEF456...",
   *   rpcUrl: "https://my-custom-rpc.example.com",
   * });
   * ```
   */
  constructor(config: StelliumConfig) {
    const rpcUrl = config.rpcUrl || getRpcUrl(config.network);
    this.server = new SorobanRpc.Server(rpcUrl);
    this.networkPassphrase = NETWORK_PASSPHRASES[config.network];
    this.escrowContractId = config.escrowContractId;
    this.paymentContractId = config.paymentContractId;
  }

  /**
   * Create and submit a direct payment transaction to the payment contract.
   *
   * Builds a Soroban transaction that calls the `pay` function on the payment contract,
   * signs it with the sender's secret key, and submits it to the network.
   *
   * @param params - Payment parameters including sender key, recipient, amount, and optional asset/metadata.
   * @returns A promise that resolves to a {@link PaymentResult} containing the payment ID and transaction hash.
   * @throws {Error} If the transaction fails to submit or is rejected by the network.
   *
   * @example
   * ```typescript
   * const result = await client.createPayment({
   *   senderSecretKey: "SABC123...",
   *   recipient: "GXYZ789...",
   *   amount: "10000000", // 1 XLM in stroops
   *   metadata: "Order #1234",
   * });
   *
   * console.log("Payment ID:", result.paymentId);
   * console.log("Transaction hash:", result.txHash);
   * ```
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const keypair = Keypair.fromSecret(params.senderSecretKey);
    const account = await this.server.getAccount(keypair.publicKey());

    const contract = new Contract(this.paymentContractId);
    const asset = params.asset || "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMWZEVFZPMZXQ";

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "pay",
          nativeToScVal(Address.fromString(keypair.publicKey()), { type: "address" }),
          nativeToScVal(Address.fromString(params.recipient), { type: "address" }),
          nativeToScVal(BigInt(params.amount), { type: "i128" }),
          nativeToScVal(Address.fromString(asset), { type: "address" }),
          nativeToScVal(Buffer.from(params.metadata || "", "utf-8"), { type: "bytes" })
        )
      )
      .setTimeout(30)
      .build();

    const signedTx = await this.server.prepareTransaction(tx);
    signedTx.sign(keypair);

    const result = await this.server.sendTransaction(signedTx);

    if (result.status === "ERROR") {
      throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
    }

    // TODO: Parse paymentId from transaction events
    // After tx is confirmed, fetch the transaction result and extract the
    // payment ID from the contract event (first value in the event data tuple)
    return {
      paymentId: 0, // Placeholder — parse from tx result events
      txHash: result.hash,
    };
  }

  /**
   * Create an escrow that locks funds from the buyer until released or refunded.
   *
   * Builds a Soroban transaction that calls the `create` function on the escrow contract.
   * The buyer's funds are locked for the specified timeout period. The buyer can release
   * the funds to the seller, or they are automatically refundable after the timeout.
   *
   * @param params - Escrow parameters including buyer key, seller address, amount, asset, and timeout.
   * @returns A promise that resolves to an {@link EscrowResult} containing the escrow ID and transaction hash.
   * @throws {Error} If the transaction fails to submit or is rejected by the network.
   *
   * @example
   * ```typescript
   * const result = await client.createEscrow({
   *   buyerSecretKey: "SABC123...",
   *   seller: "GXYZ789...",
   *   amount: "50000000", // 5 XLM in stroops
   *   asset: "CABC123...",
   *   timeoutSeconds: 86400, // 24 hours
   * });
   *
   * console.log("Escrow ID:", result.escrowId);
   * console.log("Transaction hash:", result.txHash);
   * ```
   */
  async createEscrow(params: CreateEscrowParams): Promise<EscrowResult> {
    const keypair = Keypair.fromSecret(params.buyerSecretKey);
    const account = await this.server.getAccount(keypair.publicKey());

    const contract = new Contract(this.escrowContractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "create",
          nativeToScVal(Address.fromString(keypair.publicKey()), { type: "address" }),
          nativeToScVal(Address.fromString(params.seller), { type: "address" }),
          nativeToScVal(BigInt(params.amount), { type: "i128" }),
          nativeToScVal(Address.fromString(params.asset), { type: "address" }),
          nativeToScVal(BigInt(params.timeoutSeconds), { type: "u64" })
        )
      )
      .setTimeout(30)
      .build();

    const signedTx = await this.server.prepareTransaction(tx);
    signedTx.sign(keypair);

    const result = await this.server.sendTransaction(signedTx);

    if (result.status === "ERROR") {
      throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
    }

    return {
      escrowId: 0, // Parse from events after tx is confirmed
      txHash: result.hash,
    };
  }

  /**
   * Release escrow funds to the seller.
   *
   * This action can only be performed by the buyer. Once released, the escrowed funds
   * are transferred to the seller's account.
   *
   * @param params - Escrow action parameters containing the buyer's secret key and escrow ID.
   * @returns A promise that resolves to the transaction hash string.
   * @throws {Error} If the transaction fails or the caller is not the escrow buyer.
   *
   * @example
   * ```typescript
   * const txHash = await client.releaseEscrow({
   *   secretKey: "SABC123...", // buyer's secret key
   *   escrowId: 1,
   * });
   * console.log("Released, tx hash:", txHash);
   * ```
   */
  async releaseEscrow(params: EscrowActionParams): Promise<string> {
    return this.escrowAction(params, "release");
  }

  /**
   * Refund escrow funds back to the buyer.
   *
   * This action is typically available after the escrow timeout has elapsed.
   * The locked funds are returned to the buyer's account.
   *
   * @param params - Escrow action parameters containing the user's secret key and escrow ID.
   * @returns A promise that resolves to the transaction hash string.
   * @throws {Error} If the transaction fails or the timeout has not yet elapsed.
   *
   * @example
   * ```typescript
   * const txHash = await client.refundEscrow({
   *   secretKey: "SABC123...",
   *   escrowId: 1,
   * });
   * console.log("Refunded, tx hash:", txHash);
   * ```
   */
  async refundEscrow(params: EscrowActionParams): Promise<string> {
    return this.escrowAction(params, "refund");
  }

  /**
   * Verify whether a payment exists and has been completed on-chain.
   *
   * Uses Soroban's simulate transaction to read the payment contract state
   * without requiring a funded account or submitting a real transaction.
   *
   * @param paymentId - The numeric ID of the payment to verify.
   * @returns A promise that resolves to `true` if the payment exists and is completed, `false` otherwise.
   * @throws {Error} If the RPC call fails due to network issues.
   *
   * @example
   * ```typescript
   * const isComplete = await client.verifyPayment(1);
   * if (isComplete) {
   *   console.log("Payment is confirmed!");
   * } else {
   *   console.log("Payment not found or not yet completed.");
   * }
   * ```
   */
  async verifyPayment(paymentId: number): Promise<boolean> {
    const contract = new Contract(this.paymentContractId);

    const tx = new TransactionBuilder(
      // Dummy source account — simulation doesn't require a funded account
      new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
    )
      .addOperation(
        contract.call("verify", nativeToScVal(BigInt(paymentId), { type: "u64" }))
      )
      .setTimeout(30)
      .build();

    let result: SorobanRpc.Api.SimulateTransactionResponse;
    try {
      result = await this.server.simulateTransaction(tx);
    } catch (err) {
      throw new Error(
        `Failed to verify payment ${paymentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (SorobanRpc.Api.isSimulationSuccess(result) && result.result?.retval) {
      return scValToNative(result.result.retval) as boolean;
    }

    return false;
  }

  /**
   * Read payment details from the payment contract.
   *
   * Uses Soroban's simulate transaction to fetch the full payment record
   * including sender, recipient, amount, asset, metadata, and completion status.
   *
   * @param paymentId - The numeric ID of the payment to retrieve.
   * @returns A promise that resolves to a {@link PaymentDetails} object if found, or `null` if the payment does not exist.
   * @throws {Error} If the RPC call fails due to network issues.
   *
   * @example
   * ```typescript
   * const payment = await client.getPayment(1);
   * if (payment) {
   *   console.log(`Payment from ${payment.sender} to ${payment.recipient}`);
   *   console.log(`Amount: ${payment.amount} stroops`);
   *   console.log(`Completed: ${payment.completed}`);
   * } else {
   *   console.log("Payment not found.");
   * }
   * ```
   */
  async getPayment(paymentId: number): Promise<PaymentDetails | null> {
    const contract = new Contract(this.paymentContractId);

    const tx = new TransactionBuilder(
      new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
    )
      .addOperation(
        contract.call("get_payment", nativeToScVal(BigInt(paymentId), { type: "u64" }))
      )
      .setTimeout(30)
      .build();

    let result: SorobanRpc.Api.SimulateTransactionResponse;
    try {
      result = await this.server.simulateTransaction(tx);
    } catch (err) {
      throw new Error(
        `Failed to get payment ${paymentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!SorobanRpc.Api.isSimulationSuccess(result) || !result.result?.retval) {
      return null;
    }

    const raw = scValToNative(result.result.retval) as {
      id: bigint;
      sender: string;
      recipient: string;
      amount: bigint;
      asset: string;
      metadata: Uint8Array;
      completed: boolean;
    };

    return {
      id: Number(raw.id),
      sender: raw.sender,
      recipient: raw.recipient,
      amount: raw.amount.toString(),
      asset: raw.asset,
      metadata: Buffer.from(raw.metadata).toString("utf-8"),
      completed: raw.completed,
    };
  }

  /**
   * Read escrow details from the escrow contract.
   *
   * Uses Soroban's simulate transaction to fetch the full escrow record
   * including buyer, seller, amount, asset, timeout, and release/refund status.
   *
   * @param escrowId - The numeric ID of the escrow to retrieve.
   * @returns A promise that resolves to an {@link EscrowDetails} object if found, or `null` if the escrow does not exist.
   * @throws {Error} Always throws with "Not implemented" until the feature is completed.
   *
   * @example
   * ```typescript
   * // Not yet implemented — see CONTRIBUTING.md
   * const escrow = await client.getEscrow(1);
   * ```
   */
  // TODO: Implement getEscrow using Soroban RPC simulate
  // Should call the escrow contract's `get_escrow` function and return typed details
  async getEscrow(escrowId: number): Promise<EscrowDetails | null> {
    // Use this.server.simulateTransaction() to call `get_escrow(escrow_id)`
    // Parse the ScVal response into an EscrowDetails object
    throw new Error("Not implemented — see CONTRIBUTING.md");
  }

  /**
   * Internal helper to execute escrow release or refund actions.
   *
   * @param params - Escrow action parameters containing the user's secret key and escrow ID.
   * @param action - The action to perform: `"release"` or `"refund"`.
   * @returns A promise that resolves to the transaction hash string.
   * @throws {Error} If the transaction fails to submit or is rejected by the network.
   */
  private async escrowAction(
    params: EscrowActionParams,
    action: "release" | "refund"
  ): Promise<string> {
    const keypair = Keypair.fromSecret(params.secretKey);
    const account = await this.server.getAccount(keypair.publicKey());

    const contract = new Contract(this.escrowContractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          action,
          nativeToScVal(BigInt(params.escrowId), { type: "u64" })
        )
      )
      .setTimeout(30)
      .build();

    const signedTx = await this.server.prepareTransaction(tx);
    signedTx.sign(keypair);

    const result = await this.server.sendTransaction(signedTx);

    if (result.status === "ERROR") {
      throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
    }

    return result.hash;
  }
}
