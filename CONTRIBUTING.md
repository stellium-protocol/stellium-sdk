# Contributing to Stellium SDK

Thanks for your interest in contributing! This guide will help you get set up.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
git clone https://github.com/stellium/stellium-sdk.git
cd stellium-sdk
npm install
npm test        # Run tests
npm run lint    # Type check
npm run build   # Build CJS + ESM + types
```

### Project Structure

```
src/
├── index.ts        ← Public exports (add new exports here)
├── client.ts       ← StelliumClient class (main API)
├── types.ts        ← TypeScript interfaces
├── utils.ts        ← Helpers (XLM conversion, address validation)
└── webhooks.ts     ← Webhook signature verification
tests/
└── client.test.ts  ← Unit tests
```

## How to Contribute

1. Find an issue you want to work on
2. Comment on the issue to let others know
3. Fork the repo and create a branch
4. Make your changes
5. Run `npm test` and `npm run lint` — both must pass
6. Submit a PR linking the issue

## Development Workflow

- **Add a new feature**: Add the method to `client.ts`, types to `types.ts`, export from `index.ts`, test in `client.test.ts`
- **Fix a bug**: Write a failing test first, then fix it
- **Add a utility**: Add to `utils.ts`, export from `index.ts`

## SDK Design Principles

- **Async-first**: All blockchain interactions return Promises
- **Type-safe**: Every parameter and return value has a TypeScript type
- **Minimal deps**: Only depend on `@stellar/stellar-sdk`
- **Clear errors**: Throw descriptive errors, not generic ones

## Testing

We use Vitest. Run tests with:

```bash
npm test
```

When adding new methods, add tests that:
- Verify the happy path
- Handle error cases
- Validate input parameters

## Stellar Resources

- [Stellar SDK Docs](https://developers.stellar.org/docs/build/smart-contracts)
- [Soroban RPC Reference](https://developers.stellar.org/docs/data/rpc)
- [Stellar Laboratory](https://laboratory.stellar.org/) (test account creation)
