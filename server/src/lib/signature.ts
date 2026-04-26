import { ethers } from "ethers";
import { isValidWallet } from "./wallet";

/// Signature digest:  keccak256(abi.encodePacked(address, uint8, uint256))
/// Wrapped with the standard `\x19Ethereum Signed Message:\n32` prefix via
/// `signMessage`, so the on-chain verifier should call `toEthSignedMessageHash`
/// before recovery.

let cachedSigner: ethers.Wallet | null = null;
let cachedKey: string | null = null;

function getSigner(): ethers.Wallet {
  const pk = process.env.MINT_SIGNER_PRIVATE_KEY;
  if (!pk) throw new Error("MINT_SIGNER_PRIVATE_KEY_not_configured");
  if (cachedSigner && cachedKey === pk) return cachedSigner;
  cachedSigner = new ethers.Wallet(pk);
  cachedKey = pk;
  return cachedSigner;
}

export function getSignerAddress(): string {
  return getSigner().address;
}

/**
 * Sign a whitelist allowance for a wallet at a given phase.
 *
 * @param wallet      0x-prefixed EVM address being authorised
 * @param phase       0=GTD, 1=FCFS, 2=Public
 * @param maxAllowed  Max tokens this wallet may mint (interpretation depends on
 *                    on-chain accounting — cumulative or per-phase)
 * @returns           65-byte hex signature (r||s||v)
 */
export async function generateSignature(
  wallet: string,
  phase: number,
  maxAllowed: number | bigint
): Promise<string> {
  if (!isValidWallet(wallet)) throw new Error("invalid_wallet");
  if (!Number.isInteger(phase) || phase < 0 || phase > 2) {
    throw new Error("invalid_phase");
  }
  const max = typeof maxAllowed === "bigint" ? maxAllowed : BigInt(maxAllowed);
  if (max < 0n) throw new Error("invalid_max_allowed");

  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "uint8", "uint256"],
    [wallet, phase, max]
  );

  const signer = getSigner();
  return signer.signMessage(ethers.getBytes(messageHash));
}
