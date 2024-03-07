import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-foundry";

const config: HardhatUserConfig = {
  paths: {
    tests: "test/unit",
  },
  solidity: {
    version: "0.8.24",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
};

export default config;
