# Stellium SDK

TypeScript SDK for accepting Stellar payments in your app. Wraps Soroban contract calls into a simple async API.

## Overview

This SDK lets you:
- Create direct payments (XLM or any Stellar token)
- Create and manage escrow transactions
- Verify webhook signatures from Stellium
- Convert between XLM and stroops

## Install

```bash
npm install @stellium/stellium-sdk
```

## Quick Start

```typescript
import { StelliumClient } from "@stellium/stellium-sdk";

const client = new StelliumClient({
  network: "testnet",
  escrowContractId: "C...",  // Deployed escrow contract address
  paymentContractId: "C...", // Deployed payment contract address
});

// Send a direct payment
const result = await client.createPayment({
  senderSecretKey: "S...",
  recipient: "G...",
  amount: "10000000", // 1 XLM in stroops
});
console.log(`Payment sent! TX: ${result.txHash}`);

// Create an escrow
const escrow = await client.createEscrow({
  buyerSecretKey: "S...",
  seller: "G...",
  amount: "50000000",
  asset: "C...", // Token contract address
  timeoutSeconds: 86400, // 24 hours
});
console.log(`Escrow created! ID: ${escrow.escrowId}`);

// Release escrow after delivery
await client.releaseEscrow({
  secretKey: "S...",
  escrowId: escrow.escrowId,
});
```

## Webhook Verification

```typescript
import { verifyWebhookSignature } from "@stellium/stellium-sdk";

// In your webhook handler
app.post("/webhooks/stellium", (req, res) => {
  const isValid = verifyWebhookSignature(
    req.rawBody,
    req.headers["x-stellium-signature"],
    process.env.WEBHOOK_SECRET
  );

  if (!isValid) return res.status(401).send("Invalid signature");

  // Process the webhook event...
});
```

## API Reference

### `StelliumClient`

| Method | Description | Status |
|--------|-------------|--------|
| `createPayment(params)` | Send a direct payment | Working |
| `createEscrow(params)` | Lock funds in escrow | Working |
| `releaseEscrow(params)` | Release escrow to seller | Working |
| `refundEscrow(params)` | Refund escrow to buyer (after timeout) | Working |
| `verifyPayment(id)` | Check if payment is completed | **Needs implementation** |
| `getPayment(id)` | Get payment details from chain | **Needs implementation** |
| `getEscrow(id)` | Get escrow details from chain | **Needs implementation** |

### Utilities

| Function | Description |
|----------|-------------|
| `stroopsToXlm(stroops)` | Convert stroops to human-readable XLM |
| `xlmToStroops(xlm)` | Convert XLM to stroops |
| `isValidStellarAddress(addr)` | Validate a Stellar address format |
| `verifyWebhookSignature(body, sig, secret)` | Verify HMAC-SHA256 webhook signature |
| `parseWebhookEvent(body)` | Parse and validate a webhook payload |

## Project Structure

```
src/
├── index.ts        ← Public exports
├── client.ts       ← StelliumClient class
├── types.ts        ← TypeScript interfaces
├── utils.ts        ← XLM/stroops conversion, address validation
└── webhooks.ts     ← Webhook signature verification
tests/
└── client.test.ts  ← Unit tests (needs more coverage)
```

## Prerequisites

- Node.js 18+
- Stellar testnet account (get one at [laboratory.stellar.org](https://laboratory.stellar.org/#account-creator?network=testnet))

## Development

```bash
npm install
npm run build    # Build CJS + ESM + types
npm test         # Run tests
npm run lint     # Type check
```

## What Needs Work

The SDK has a working foundation for creating transactions but needs contributions:

**Missing implementations:**
- `verifyPayment()` — Read contract state via Soroban RPC simulate
- `getPayment()` — Parse contract storage to return payment details
- `getEscrow()` — Parse contract storage to return escrow details
- Event ID parsing from transaction results (currently returns `0` for paymentId/escrowId)
- Transaction status polling (wait for confirmation)

**Missing features:**
- Batch payments (send to multiple recipients)
- Transaction retry logic on network errors
- Event streaming (subscribe to contract events via Soroban RPC)
- Support for Stellar Passkeys and other wallet types (currently only secret keys)
- Error handling with typed error classes

**Testing gaps:**
- Tests for `createPayment` and `createEscrow` with mocked Soroban RPC
- Tests for error cases (invalid addresses, failed transactions)
- Edge case tests (zero amounts, maximum values)

## License

MIT
