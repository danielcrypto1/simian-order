import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PK = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = PK ? [PK] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 800 },
      viaIR: false,
    },
  },
  paths: {
    sources: "contracts",
    tests: "test",
    cache: "cache",
    artifacts: "artifacts",
  },
  networks: {
    apechain: {
      url: process.env.APECHAIN_RPC_URL || "https://apechain.calderachain.xyz/http",
      chainId: 33139,
      accounts,
    },
    curtis: {
      url: process.env.CURTIS_RPC_URL || "https://curtis.rpc.caldera.xyz/http",
      chainId: 33111,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      apechain: process.env.APESCAN_API_KEY || "etherscan-not-required",
      curtis: process.env.APESCAN_API_KEY || "etherscan-not-required",
    },
    customChains: [
      {
        network: "apechain",
        chainId: 33139,
        urls: {
          apiURL: "https://api.apescan.io/api",
          browserURL: "https://apescan.io",
        },
      },
      {
        network: "curtis",
        chainId: 33111,
        urls: {
          apiURL: "https://api-curtis.apescan.io/api",
          browserURL: "https://curtis.apescan.io",
        },
      },
    ],
  },
};

export default config;
