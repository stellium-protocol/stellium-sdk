/**
 * Base error class for all Stellium SDK errors.
 *
 * All custom error types in the SDK extend this class, allowing consumers
 * to catch all SDK-specific errors with a single `catch` block.
 *
 * @example
 * ```typescript
 * import { StelliumError } from "@stellium/stellium-sdk";
 *
 * try {
 *   await client.createPayment({ ... });
 * } catch (err) {
 *   if (err instanceof StelliumError) {
 *     console.error("SDK error:", err.code, err.message);
 *   }
 * }
 * ```
 */
export class StelliumError extends Error {
  /** Machine-readable error code for programmatic handling. */
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "StelliumError";
    this.code = code;
    // Fix prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a network or RPC request fails.
 *
 * Indicates issues communicating with the Soroban RPC server,
 * such as timeouts, connection refused, or DNS resolution failures.
 *
 * @example
 * ```typescript
 * import { NetworkError } from "@stellium/stellium-sdk";
 *
 * try {
 *   await client.createPayment({ ... });
 * } catch (err) {
 *   if (err instanceof NetworkError) {
 *     console.error("Network issue, retrying...", err.message);
 *   }
 * }
 * ```
 */
export class NetworkError extends StelliumError {
  constructor(message: string) {
    super(message, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

/**
 * Error thrown when a smart contract call fails.
 *
 * Indicates the Soroban contract execution reverted or returned an error,
 * such as insufficient balance, unauthorized access, or invalid arguments.
 *
 * @example
 * ```typescript
 * import { ContractError } from "@stellium/stellium-sdk";
 *
 * try {
 *   await client.releaseEscrow({ secretKey: "...", escrowId: 1 });
 * } catch (err) {
 *   if (err instanceof ContractError) {
 *     console.error("Contract rejected:", err.message);
 *   }
 * }
 * ```
 */
export class ContractError extends StelliumError {
  constructor(message: string) {
    super(message, "CONTRACT_ERROR");
    this.name = "ContractError";
  }
}

/**
 * Error thrown when input validation fails.
 *
 * Indicates that a parameter passed to an SDK method is invalid,
 * such as a malformed Stellar address, negative amount, or missing required field.
 *
 * @example
 * ```typescript
 * import { ValidationError, isValidStellarAddress } from "@stellium/stellium-sdk";
 *
 * if (!isValidStellarAddress(recipient)) {
 *   throw new ValidationError("Invalid recipient address", "INVALID_ADDRESS");
 * }
 * ```
 */
export class ValidationError extends StelliumError {
  constructor(message: string, code: string = "VALIDATION_ERROR") {
    super(message, code);
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when a Stellar transaction fails to submit or is rejected.
 *
 * Wraps the raw transaction error result from the Soroban RPC server,
 * providing both a human-readable message and access to the underlying error data.
 *
 * @example
 * ```typescript
 * import { TransactionError } from "@stellium/stellium-sdk";
 *
 * try {
 *   await client.createPayment({ ... });
 * } catch (err) {
 *   if (err instanceof TransactionError) {
 *     console.error("Tx failed:", err.message);
 *     console.error("Raw result:", err.errorResult);
 *   }
 * }
 * ```
 */
export class TransactionError extends StelliumError {
  /** The raw error result returned by the Soroban RPC server, if available. */
  public readonly errorResult?: unknown;

  constructor(message: string, errorResult?: unknown) {
    super(message, "TRANSACTION_ERROR");
    this.name = "TransactionError";
    this.errorResult = errorResult;
  }
}
