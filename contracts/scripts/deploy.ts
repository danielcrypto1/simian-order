import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("deployer:", deployer.address);

  const NAME = process.env.NFT_NAME ?? "Simian Order";
  const SYMBOL = process.env.NFT_SYMBOL ?? "SIMIAN";
  const ROYALTY_RECEIVER = process.env.ROYALTY_RECEIVER ?? deployer.address;
  const SIGNER = process.env.MINT_SIGNER ?? deployer.address;
  const BASE_URI = process.env.BASE_URI ?? "ipfs://placeholder/";

  const F = await ethers.getContractFactory("SimianOrder");
  const c = await F.deploy(NAME, SYMBOL, ROYALTY_RECEIVER, SIGNER, BASE_URI);
  await c.waitForDeployment();

  const addr = await c.getAddress();
  console.log("SimianOrder deployed at:", addr);
  console.log("  royaltyReceiver:", ROYALTY_RECEIVER);
  console.log("  signer:         ", SIGNER);
  console.log("  baseURI:        ", BASE_URI);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
