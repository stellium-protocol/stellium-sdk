import type { Network } from "./types";

const RPC_URLS: Record<Network, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
};

export function getRpcUrl(network: Network): string {
  return RPC_URLS[network];
}

/** Convert stroops to human-readable XLM */
export function stroopsToXlm(stroops: string | number): string {
  const value = Number(stroops) / 10_000_000;
  return value.toFixed(7);
}

/** Convert XLM to stroops */
export function xlmToStroops(xlm: string | number): string {
  const value = Number(xlm) * 10_000_000;
  return Math.floor(value).toString();
}

/** Validate a Stellar address (starts with G, 56 chars) */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}
