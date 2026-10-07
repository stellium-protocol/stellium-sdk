import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  stroopsToXlm,
  xlmToStroops,
  isValidStellarAddress,
  verifyWebhookSignature,
  parseWebhookEvent,
  StelliumClient,
  TransactionError,
  NetworkError,
} from "../src";
import { Account, nativeToScVal } from "@stellar/stellar-sdk";

// Mock Soroban RPC methods
const mockGetAccount = vi.fn();
const mockPrepareTransaction = vi.fn();
const mockSendTransaction = vi.fn();
const mockSimulateTransaction = vi.fn();

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();

  class MockServer {
    getAccount = mockGetAccount;
    prepareTransaction = mockPrepareTransaction;
    sendTransaction = mockSendTransaction;
    simulateTransaction = mockSimulateTransaction;
  }

  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: vi.fn().mockImplementation(() => new MockServer()),
    },
  };
});

// Test fixtures with valid StrKey checksums
const TEST_PAYMENT_CONTRACT = "CBHBRFIJV4YU355CQ5WS626XSCQATO66MY7TGWI64U5YLQKEU3OBN3S3";
const TEST_ESCROW_CONTRACT = "CCKRD2PBXBBX7RPILOIWBXL6YDUMJYGX4FDKV4F222HLDJBFDJVVKW7C";
const TEST_ASSET = "CDSGE2R5K2HQGGNZLMQ2V7PQW2QTSELQBP2RWXFSYMVRG6WBP62LCO7G";

const SENDER_SECRET = "SAYFQJ4N4TGAVV56QQ7WD52OV5TYCW4CRFRT6QUDVIQCCRJTIBV4EUWQ";
const SENDER_PUBLIC = "GAOCLWGKTJJL2VW6OFXY7BD74CRWUUTINGOTVDR75SUGJQRIVUSEU7XM";
const RECIPIENT_PUBLIC = "GAZSIFYUJRFPFB5XZI3P523NYRYOIW6CUDVCRDDIOSIG3FEVPY4TCWCV";

describe("utils", () => {
  it("converts stroops to XLM", () => {
    expect(stroopsToXlm(10000000)).toBe("1.0000000");
    expect(stroopsToXlm(5000000)).toBe("0.5000000");
    expect(stroopsToXlm(0)).toBe("0.0000000");
  });

  it("converts XLM to stroops", () => {
    expect(xlmToStroops("1")).toBe("10000000");
    expect(xlmToStroops("0.5")).toBe("5000000");
    expect(xlmToStroops("0")).toBe("0");
  });

  it("validates Stellar addresses", () => {
    expect(isValidStellarAddress("G".concat("A".repeat(55)))).toBe(true);
    expect(isValidStellarAddress("invalid")).toBe(false);
    expect(isValidStellarAddress("")).toBe(false);
    expect(isValidStellarAddress("S".concat("A".repeat(55)))).toBe(false); // Secret key, not address
  });
});

describe("webhooks", () => {
  it("verifies valid HMAC-SHA256 signatures", () => {
    const secret = "whsec_test123";
    const payload = '{"type":"payment.created","id":1}';
    const crypto = require("crypto");
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(verifyWebhookSignature("{}", "bad", "secret")).toBe(false);
  });

  it("rejects tampered payloads", () => {
    const crypto = require("crypto");
    const secret = "whsec_test123";
    const originalPayload = '{"type":"payment.created","id":1}';
    const tamperedPayload = '{"type":"payment.created","id":999}';
    const signature = crypto.createHmac("sha256", secret).update(originalPayload).digest("hex");

    expect(verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(false);
  });

  it("parses valid webhook events", () => {
    const event = parseWebhookEvent(
      '{"type":"payment.created","id":1,"timestamp":1234567890,"data":{}}'
    );
    expect(event.type).toBe("payment.created");
    expect(event.id).toBe(1);
  });

  it("throws on invalid webhook payloads", () => {
    expect(() => parseWebhookEvent("{}")).toThrow("missing required fields");
  });
});

describe("StelliumClient", () => {
  let client: StelliumClient;
  const mockTxHash = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";

  beforeEach(() => {
    vi.clearAllMocks();
    client = new StelliumClient({
      network: "testnet",
      paymentContractId: TEST_PAYMENT_CONTRACT,
      escrowContractId: TEST_ESCROW_CONTRACT,
    });

    mockGetAccount.mockResolvedValue(new Account(SENDER_PUBLIC, "100"));
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: mockTxHash,
    });
  });

  it("creates a payment and returns tx hash", async () => {
    const result = await client.createPayment({
      senderSecretKey: SENDER_SECRET,
      recipient: RECIPIENT_PUBLIC,
      amount: "10000000",
      asset: TEST_ASSET,
      metadata: "Order #1234",
    });

    expect(result.txHash).toBe(mockTxHash);
    expect(result.paymentId).toBe(0);
    expect(mockGetAccount).toHaveBeenCalledWith(SENDER_PUBLIC);
    expect(mockPrepareTransaction).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
  });

  it("creates an escrow and returns escrow ID + tx hash", async () => {
    const result = await client.createEscrow({
      buyerSecretKey: SENDER_SECRET,
      seller: RECIPIENT_PUBLIC,
      amount: "50000000",
      asset: TEST_ASSET,
      timeoutSeconds: 86400,
    });

    expect(result.txHash).toBe(mockTxHash);
    expect(result.escrowId).toBe(0);
    expect(mockGetAccount).toHaveBeenCalledWith(SENDER_PUBLIC);
    expect(mockPrepareTransaction).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
  });

  it("releases an escrow successfully", async () => {
    const txHash = await client.releaseEscrow({
      secretKey: SENDER_SECRET,
      escrowId: 1,
    });

    expect(txHash).toBe(mockTxHash);
    expect(mockGetAccount).toHaveBeenCalledWith(SENDER_PUBLIC);
    expect(mockPrepareTransaction).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
  });

  it("refunds an escrow after timeout", async () => {
    const txHash = await client.refundEscrow({
      secretKey: SENDER_SECRET,
      escrowId: 1,
    });

    expect(txHash).toBe(mockTxHash);
    expect(mockGetAccount).toHaveBeenCalledWith(SENDER_PUBLIC);
    expect(mockPrepareTransaction).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
  });

  it("verifies payment status via simulation", async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: {
        retval: nativeToScVal(true, { type: "bool" }),
      },
    });

    const isVerified = await client.verifyPayment(1);
    expect(isVerified).toBe(true);
    expect(mockSimulateTransaction).toHaveBeenCalled();
  });

  it("returns false when verify payment simulation fails or returns false", async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      error: "Simulation failed",
    });

    const isVerified = await client.verifyPayment(999);
    expect(isVerified).toBe(false);
  });

  it("reads payment details via simulation", async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: {
        retval: nativeToScVal({
          id: 1n,
          sender: SENDER_PUBLIC,
          recipient: RECIPIENT_PUBLIC,
          amount: 10000000n,
          asset: TEST_ASSET,
          metadata: Buffer.from("Invoice #42", "utf-8"),
          completed: true,
        }),
      },
    });

    const payment = await client.getPayment(1);
    expect(payment).toEqual({
      id: 1,
      sender: SENDER_PUBLIC,
      recipient: RECIPIENT_PUBLIC,
      amount: "10000000",
      asset: TEST_ASSET,
      metadata: "Invoice #42",
      completed: true,
    });
  });

  it("returns null when payment is not found in simulation", async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      error: "HostError",
    });

    const payment = await client.getPayment(404);
    expect(payment).toBeNull();
  });

  it("reads escrow details via simulation", async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      transactionData: {},
      result: {
        retval: nativeToScVal({
          id: 1n,
          buyer: SENDER_PUBLIC,
          seller: RECIPIENT_PUBLIC,
          amount: 50000000n,
          asset: TEST_ASSET,
          timeout: 86400n,
          released: false,
          refunded: false,
        }),
      },
    });

    const escrow = await client.getEscrow(1);
    expect(escrow).toEqual({
      id: 1,
      buyer: SENDER_PUBLIC,
      seller: RECIPIENT_PUBLIC,
      amount: "50000000",
      asset: TEST_ASSET,
      timeout: 86400,
      released: false,
      refunded: false,
    });
  });

  it("throws on invalid secret key format", async () => {
    await expect(
      client.createPayment({
        senderSecretKey: "invalid-key",
        recipient: RECIPIENT_PUBLIC,
        amount: "10000000",
        asset: TEST_ASSET,
      })
    ).rejects.toThrow();
  });

  it("throws TransactionError when transaction submission status is ERROR", async () => {
    mockSendTransaction.mockResolvedValueOnce({
      status: "ERROR",
      errorResult: "tx_insufficient_balance",
    });

    await expect(
      client.createPayment({
        senderSecretKey: SENDER_SECRET,
        recipient: RECIPIENT_PUBLIC,
        amount: "10000000",
        asset: TEST_ASSET,
      })
    ).rejects.toThrow(TransactionError);
  });

  it("handles network errors and throws NetworkError after exhausting retries", async () => {
    mockPrepareTransaction.mockRejectedValue(new Error("RPC node down"));

    await expect(
      client.createPayment({
        senderSecretKey: SENDER_SECRET,
        recipient: RECIPIENT_PUBLIC,
        amount: "10000000",
        asset: TEST_ASSET,
      })
    ).rejects.toThrow(NetworkError);
  }, 10000);
});
