import { describe, it, expect } from "vitest";
import {
  stroopsToXlm,
  xlmToStroops,
  isValidStellarAddress,
  verifyWebhookSignature,
  parseWebhookEvent,
} from "../src";

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

// ========================================
// TODO: Add StelliumClient tests
// ========================================
//
// These tests need mocked Soroban RPC. Consider using:
// - vitest's vi.mock() to mock @stellar/stellar-sdk
// - Or a test helper that creates a mock SorobanRpc.Server
//
// Tests to add:
//
// describe("StelliumClient", () => {
//   it("creates a payment and returns tx hash");
//   it("creates an escrow and returns escrow ID + tx hash");
//   it("releases an escrow successfully");
//   it("refunds an escrow after timeout");
//   it("throws on invalid secret key");
//   it("throws on invalid recipient address");
//   it("throws when transaction fails");
//   it("handles network errors gracefully");
// });
