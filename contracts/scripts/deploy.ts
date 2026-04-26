import { ethers, network, run } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("network:        ", network.name, `(chainId ${network.config.chainId})`);
  console.log("deployer:       ", deployer.address);
  console.log("deployer balance:", ethers.formatEther(balance), "(native)");

  const NAME = process.env.NFT_NAME ?? "Simian Order";
  const SYMBOL = process.env.NFT_SYMBOL ?? "SIMIAN";
  const ROYALTY_RECEIVER = process.env.ROYALTY_RECEIVER ?? deployer.address;
  const SIGNER = process.env.MINT_SIGNER ?? deployer.address;
  const BASE_URI = process.env.BASE_URI ?? "ipfs://placeholder/";

  console.log("constructor args:");
  console.log("  name:           ", NAME);
  console.log("  symbol:         ", SYMBOL);
  console.log("  royaltyReceiver:", ROYALTY_RECEIVER);
  console.log("  signer:         ", SIGNER);
  console.log("  baseURI:        ", BASE_URI);

  const F = await ethers.getContractFactory("SimianOrder");
  const c = await F.deploy(NAME, SYMBOL, ROYALTY_RECEIVER, SIGNER, BASE_URI);
  await c.waitForDeployment();
  const address = await c.getAddress();
  console.log("\nSimianOrder deployed to:", address);

  // Read ABI from compiled artifact.
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "SimianOrder.sol",
    "SimianOrder.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
    abi: unknown[];
  };

  // Persist deployment.
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const out = {
    network: network.name,
    chainId: network.config.chainId,
    address,
    deployer: deployer.address,
    constructorArgs: {
      name: NAME,
      symbol: SYMBOL,
      royaltyReceiver: ROYALTY_RECEIVER,
      signer: SIGNER,
      baseURI: BASE_URI,
    },
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(out, null, 2));
  console.log("wrote", deploymentFile);

  // Mirror ABI into the frontend so /lib/abi/SimianOrder.json stays current.
  const feAbiDir = path.join(__dirname, "..", "..", "lib", "abi");
  fs.mkdirSync(feAbiDir, { recursive: true });
  const feAbiFile = path.join(feAbiDir, "SimianOrder.json");
  fs.writeFileSync(feAbiFile, JSON.stringify({ address, chainId: network.config.chainId, abi: artifact.abi }, null, 2));
  console.log("wrote", feAbiFile);

  // Optional Etherscan/Apescan verify if API keys are configured.
  if (process.env.APESCAN_API_KEY && network.name !== "hardhat") {
    console.log("\nverifying on apescan…");
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [NAME, SYMBOL, ROYALTY_RECEIVER, SIGNER, BASE_URI],
      });
    } catch (e) {
      console.warn("verify skipped:", (e as Error).message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
