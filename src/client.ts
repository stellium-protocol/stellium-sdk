import {
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
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

export class StelliumClient {
  private server: SorobanRpc.Server;
  private networkPassphrase: string;
  private escrowContractId: string;
  private paymentContractId: string;

  constructor(config: StelliumConfig) {
    const rpcUrl = config.rpcUrl || getRpcUrl(config.network);
    this.server = new SorobanRpc.Server(rpcUrl);
    this.networkPassphrase = NETWORK_PASSPHRASES[config.network];
    this.escrowContractId = config.escrowContractId;
    this.paymentContractId = config.paymentContractId;
  }

  /** Create and submit a direct payment */
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

  /** Create an escrow — locks funds from buyer */
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

  /** Release escrow funds to seller (buyer only) */
  async releaseEscrow(params: EscrowActionParams): Promise<string> {
    return this.escrowAction(params, "release");
  }

  /** Refund escrow to buyer (after timeout) */
  async refundEscrow(params: EscrowActionParams): Promise<string> {
    return this.escrowAction(params, "refund");
  }

  // TODO: Implement verifyPayment using Soroban RPC simulate
  // Should call the payment contract's `verify` function and return the boolean result
  // See: https://developers.stellar.org/docs/build/smart-contracts/invoking
  async verifyPayment(paymentId: number): Promise<boolean> {
    const contract = new Contract(this.paymentContractId);
    // Use this.server.simulateTransaction() to call the read-only `verify` function
    // Parse the return value from the simulation result
    throw new Error("Not implemented — see CONTRIBUTING.md");
  }

  // TODO: Implement getPayment using Soroban RPC simulate
  // Should call the payment contract's `get_payment` function and return typed details
  async getPayment(paymentId: number): Promise<PaymentDetails | null> {
    // Use this.server.simulateTransaction() to call `get_payment(payment_id)`
    // Parse the ScVal response into a PaymentDetails object
    throw new Error("Not implemented — see CONTRIBUTING.md");
  }

  // TODO: Implement getEscrow using Soroban RPC simulate
  // Should call the escrow contract's `get_escrow` function and return typed details
  async getEscrow(escrowId: number): Promise<EscrowDetails | null> {
    // Use this.server.simulateTransaction() to call `get_escrow(escrow_id)`
    // Parse the ScVal response into an EscrowDetails object
    throw new Error("Not implemented — see CONTRIBUTING.md");
  }

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
