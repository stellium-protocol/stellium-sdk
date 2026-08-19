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
import { StelliumNetworkError, StelliumTransactionError } from "./errors";
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

  /** Helper to retry async operations on network errors */
  private async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        // Don't retry if it's a known transaction error (e.g. simulation failed or rejected)
        if (err instanceof StelliumTransactionError) throw err;
        
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    throw new StelliumNetworkError(`Operation failed after ${maxRetries} attempts`, lastError);
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

    const result = await this.withRetry(async () => {
      const signedTx = await this.server.prepareTransaction(tx);
      signedTx.sign(keypair);
      return await this.server.sendTransaction(signedTx);
    });

    if (result.status === "ERROR") {
      throw new StelliumTransactionError("Transaction failed", result.errorResult);
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

    const result = await this.withRetry(async () => {
      const signedTx = await this.server.prepareTransaction(tx);
      signedTx.sign(keypair);
      return await this.server.sendTransaction(signedTx);
    });

    if (result.status === "ERROR") {
      throw new StelliumTransactionError("Transaction failed", result.errorResult);
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

  /** Verify whether a payment exists and is completed */
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
      result = await this.withRetry(() => this.server.simulateTransaction(tx));
    } catch (err) {
      if (err instanceof StelliumNetworkError) throw err;
      throw new StelliumNetworkError(
        `Failed to verify payment ${paymentId}: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    if (SorobanRpc.Api.isSimulationSuccess(result) && result.result?.retval) {
      return scValToNative(result.result.retval) as boolean;
    }

    return false;
  }

  /** Read payment details from the contract */
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
      result = await this.withRetry(() => this.server.simulateTransaction(tx));
    } catch (err) {
      if (err instanceof StelliumNetworkError) throw err;
      throw new StelliumNetworkError(
        `Failed to get payment ${paymentId}: ${err instanceof Error ? err.message : String(err)}`,
        err
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

  async getEscrow(escrowId: number): Promise<EscrowDetails | null> {
    const contract = new Contract(this.escrowContractId);

    const tx = new TransactionBuilder(
      new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
    )
      .addOperation(
        contract.call("get_escrow", nativeToScVal(BigInt(escrowId), { type: "u64" }))
      )
      .setTimeout(30)
      .build();

    let result: SorobanRpc.Api.SimulateTransactionResponse;
    try {
      result = await this.withRetry(() => this.server.simulateTransaction(tx));
    } catch (err) {
      throw new StelliumNetworkError(
        `Failed to get escrow ${escrowId}: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    if (!SorobanRpc.Api.isSimulationSuccess(result) || !result.result?.retval) {
      return null;
    }

    const raw = scValToNative(result.result.retval) as {
      id: bigint;
      buyer: string;
      seller: string;
      amount: bigint;
      asset: string;
      timeout: bigint;
      released: boolean;
      refunded: boolean;
    };

    return {
      id: Number(raw.id),
      buyer: raw.buyer,
      seller: raw.seller,
      amount: raw.amount.toString(),
      asset: raw.asset,
      timeout: Number(raw.timeout),
      released: raw.released,
      refunded: raw.refunded,
    };
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

    const result = await this.withRetry(async () => {
      const signedTx = await this.server.prepareTransaction(tx);
      signedTx.sign(keypair);
      return await this.server.sendTransaction(signedTx);
    });

    if (result.status === "ERROR") {
      throw new StelliumTransactionError("Transaction failed", result.errorResult);
    }

    return result.hash;
  }
}
