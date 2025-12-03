require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    arc: {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: parseInt(process.env.ARC_CHAIN_ID || "5042002"),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || process.env.ARC_EXPLORER_API_KEY || "dummy",
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://api-explorer.testnet.arc.network/api",
          browserURL: "https://explorer.testnet.arc.network"
        }
      },
      {
        network: "arc",
        chainId: parseInt(process.env.ARC_CHAIN_ID || "5042002"),
        urls: {
          apiURL: "https://api-explorer.testnet.arc.network/api",
          browserURL: "https://explorer.testnet.arc.network"
        }
      }
    ]
  }
};

