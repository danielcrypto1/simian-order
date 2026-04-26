import fs from "node:fs";
import path from "node:path";

const artifactPath = path.join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "SimianOrder.sol",
  "SimianOrder.json"
);

if (!fs.existsSync(artifactPath)) {
  console.error("artifact not found — run `npm run compile` first");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
  abi: unknown[];
};

const feAbiDir = path.join(__dirname, "..", "..", "lib", "abi");
fs.mkdirSync(feAbiDir, { recursive: true });
const out = path.join(feAbiDir, "SimianOrder.json");
fs.writeFileSync(
  out,
  JSON.stringify({ address: null, chainId: null, abi: artifact.abi }, null, 2)
);
console.log("wrote", out, `(${artifact.abi.length} ABI entries)`);
