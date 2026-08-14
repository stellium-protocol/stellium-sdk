import type { Network } from "./types";

const RPC_URLS: Record<Network, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
};

/**
 * Get the Soroban RPC URL for a given Stellar network.
 *
 * Returns the default public RPC endpoint for the specified network.
 * Used internally by {@link StelliumClient} when no custom `rpcUrl` is provided.
 *
 * @param network - The Stellar network name (`"testnet"`, `"mainnet"`, or `"futurenet"`).
 * @returns The Soroban RPC URL string for the given network.
 *
 * @example
 * ```typescript
 * const url = getRpcUrl("testnet");
 * // => "https://soroban-testnet.stellar.org"
 * ```
 */
export function getRpcUrl(network: Network): string {
  return RPC_URLS[network];
}

/**
 * Convert stroops to human-readable XLM.
 *
 * 1 XLM = 10,000,000 stroops. The result is formatted to 7 decimal places
 * to match the Stellar network's precision.
 *
 * @param stroops - The amount in stroops, as a string or number.
 * @returns The equivalent amount in XLM as a fixed-precision string (7 decimal places).
 *
 * @example
 * ```typescript
 * stroopsToXlm(10000000);  // => "1.0000000"
 * stroopsToXlm("5000000"); // => "0.5000000"
 * stroopsToXlm(0);         // => "0.0000000"
 * ```
 */
export function stroopsToXlm(stroops: string | number): string {
  const value = Number(stroops) / 10_000_000;
  return value.toFixed(7);
}

/**
 * Convert XLM to stroops.
 *
 * 1 XLM = 10,000,000 stroops. The result is floored to the nearest integer
 * since stroops are indivisible units.
 *
 * @param xlm - The amount in XLM, as a string or number.
 * @returns The equivalent amount in stroops as a string.
 *
 * @example
 * ```typescript
 * xlmToStroops("1");   // => "10000000"
 * xlmToStroops(0.5);   // => "5000000"
 * xlmToStroops("0");   // => "0"
 * ```
 */
export function xlmToStroops(xlm: string | number): string {
  const value = Number(xlm) * 10_000_000;
  return Math.floor(value).toString();
}

/**
 * Validate a Stellar public key address.
 *
 * A valid Stellar address starts with `G` and is 56 characters long,
 * containing only base-32 alphabetic characters (A-Z, 2-7).
 *
 * @param address - The string to validate as a Stellar public key.
 * @returns `true` if the address matches the Stellar public key format, `false` otherwise.
 *
 * @example
 * ```typescript
 * isValidStellarAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ23");
 * // => true
 *
 * isValidStellarAddress("invalid");          // => false
 * isValidStellarAddress("");                  // => false
 * isValidStellarAddress("S...");              // false (secret keys start with S)
 * ```
 */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}
