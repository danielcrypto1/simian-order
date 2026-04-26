# Simian Order — Contracts

ERC-721A collection with three signature-gated mint phases (GTD / FCFS / Public), ERC-2981 royalties (6.9%), and a 3,333 supply cap.

## Quick start

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

## Contract: `SimianOrder.sol`

| Item | Value |
| --- | --- |
| Standard | ERC-721A 4.3 |
| Royalty | ERC-2981, default 690 bps (6.9%) |
| Max supply | `3333` |
| Token IDs | start at `1` |
| Solidity | `0.8.24` (optimizer 800 runs) |

### Single mint entry point

```solidity
function mint(
    uint256 quantity,
    uint8 phase,           // 0=GTD, 1=FCFS, 2=Public
    uint256 maxAllowed,
    bytes calldata signature
) external payable;
```

### Signature digest

The contract recovers against:

```solidity
keccak256(abi.encodePacked(
    block.chainid,        // cross-chain replay protection
    address(this),        // cross-contract replay protection
    msg.sender,           // wallet binding
    phase,                // phase binding
    maxAllowed            // allowance binding
)).toEthSignedMessageHash();
```

The view helper `digestFor(wallet, phase, maxAllowed)` returns this exact digest so the off-chain backend (or the `/admin` panel) can sign it with `eth_sign`.

### Allowance accounting

`mintedPerWallet[wallet]` is global across phases. The off-chain signer should issue cumulative caps — e.g. if a wallet got `maxAllowed=1` in GTD and minted it, their FCFS signature must use `maxAllowed=3` to permit two more.

### Admin

| Function | Notes |
| --- | --- |
| `setPhaseActive(phase, active)` | Toggle a phase. |
| `setPhasePrice(phase, price)` | Optional per-phase price in wei. |
| `setSigner(addr)` | Rotate the authorising key. |
| `setRoyalty(receiver, feeBps)` | Update default royalty. |
| `setBaseURI(uri)` | Update metadata base. |
| `withdraw()` | Sweeps contract balance to owner. `nonReentrant`. |

### Security

- ECDSA signatures bound to chain id, contract, caller, phase and allowance.
- `nonReentrant` on `mint` and `withdraw`.
- Custom errors instead of revert strings (gas + clarity).
- Zero-address checks on signer / royalty receiver.

## Off-chain signing example (ethers v6)

```ts
import { ethers, solidityPackedKeccak256, getBytes } from "ethers";

async function sign(signer, contractAddress, wallet, phase, maxAllowed, chainId) {
  const inner = solidityPackedKeccak256(
    ["uint256", "address", "address", "uint8", "uint256"],
    [chainId, contractAddress, wallet, phase, maxAllowed]
  );
  return await signer.signMessage(getBytes(inner));
}
```

`signer.signMessage` applies the `\x19Ethereum Signed Message:\n32` prefix that the contract recovers against.

## Deploy

```bash
NFT_NAME="Simian Order" \
NFT_SYMBOL="SIMIAN" \
ROYALTY_RECEIVER=0x... \
MINT_SIGNER=0x... \
BASE_URI="ipfs://CID/" \
npm run deploy:local
```
