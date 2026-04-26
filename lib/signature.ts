import { ethers } from "ethers";

/// Server-only mint signature generator. Do NOT import from client components.
///
/// Digest matches the on-chain SimianOrder._digest():
///
///   keccak256(abi.encodePacked(
///     uint256 chainId,        // block.chainid
///     address contract,       // address(this)
///     address wallet,         // msg.sender
///     uint8   phase,
///     uint256 maxAllowed
///   ))
///
/// `signMessage` applies the `\x19Ethereum Signed Message:\n32` prefix; the
/// contract recovers via toEthSignedMessageHash.
///
/// Env:
///   - MINT_SIGNER_PRIVATE_KEY     (server-only, NEVER NEXT_PUBLIC_)
///   - NEXT_PUBLIC_CHAIN_ID
///   - NEXT_PUBLIC_CONTRACT_ADDRESS

let cachedSigner: ethers.Wallet | null = null;
let cachedKey: string | null = null;

function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function getSigner(): ethers.Wallet {
  const pk = process.env.MINT_SIGNER_PRIVATE_KEY;
  if (!pk) throw new Error("MINT_SIGNER_PRIVATE_KEY_not_configured");
  if (cachedSigner && cachedKey === pk) return cachedSigner;
  cachedSigner = new ethers.Wallet(pk);
  cachedKey = pk;
  return cachedSigner;
}

function getChainId(): bigint {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!raw) throw new Error("NEXT_PUBLIC_CHAIN_ID_not_configured");
  const n = BigInt(raw);
  if (n <= 0n) throw new Error("invalid_chain_id");
  return n;
}

function getContractAddress(): string {
  const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!addr) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS_not_configured");
  if (!isWallet(addr)) throw new Error("invalid_contract_address");
  return addr;
}

export function getSignerAddress(): string {
  return getSigner().address;
}

/**
 * Sign a mint allowance.
 *
 * @param wallet      0x-prefixed EVM address being authorised
 * @param phase       0=GTD, 1=FCFS, 2=Public
 * @param maxAllowed  Cumulative cap on this wallet's mints
 */
export async function generateSignature(
  wallet: string,
  phase: number,
  maxAllowed: number | bigint
): Promise<string> {
  if (!isWallet(wallet)) throw new Error("invalid_wallet");
  if (!Number.isInteger(phase) || phase < 0 || phase > 2) {
    throw new Error("invalid_phase");
  }
  const max = typeof maxAllowed === "bigint" ? maxAllowed : BigInt(maxAllowed);
  if (max < 0n) throw new Error("invalid_max_allowed");

  const chainId = getChainId();
  const contractAddress = getContractAddress();

  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint8", "uint256"],
    [chainId, contractAddress, wallet, phase, max]
  );

  const signer = getSigner();
  return signer.signMessage(ethers.getBytes(messageHash));
}
