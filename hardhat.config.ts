import "dotenv/config";
import {HardhatUserConfig} from "hardhat/types";

import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-deploy-tenderly";
import "hardhat-contract-sizer";
import "hardhat-abi-exporter";

import {node_url, accounts, addForkConfiguration} from "./utils/network";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      "@uniswap/lib/contracts/libraries/FixedPoint.sol": {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      "@uniswap/lib/contracts/libraries/BitMath.sol": {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      "@uniswap/lib/contracts/libraries/FullMath.sol": {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      "@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol": {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    owner: {
      default: 0,
      // mainnet: "0x0000000000000000000000000000000000000000",
      // base: "0x0000000000000000000000000000000000000000",
    },
    treasury: {
      default: 1,
      mainnet: "0x415027E07A96DE7b12077a2EAb032D0cE0a932Dc",
      // base: "0x0000000000000000000000000000000000000000",
    },
    booster: {
      default: 2,
      // base: "0x0000000000000000000000000000000000000000",
    },
  },
  networks: addForkConfiguration({
    hardhat: {
      initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
    },
    localhost: {
      url: node_url("localhost"),
      accounts: accounts(),
    },
    staging: {
      url: node_url("rinkeby"),
      accounts: accounts("rinkeby"),
    },
    production: {
      url: node_url("mainnet"),
      accounts: accounts("mainnet"),
    },
    mainnet: {
      deploy: ["deploy_l1/"],
      url: "http://localhost:24012/rpc", // truffle-dashboard
      timeout: 200000,
    },
    base: {
      url: "http://localhost:24012/rpc", // truffle-dashboard
      timeout: 200000,
    },
    sepolia: {
      url: node_url("sepolia"),
      deploy: ["deploy_l1/"],
      accounts: accounts("sepolia"),
    },
    base_sepolia: {
      url: node_url("base_sepolia"),
      accounts: accounts("base_sepolia"),
    },
    kovan: {
      url: node_url("kovan"),
      accounts: accounts("kovan"),
    },
    goerli: {
      url: node_url("goerli"),
      accounts: accounts("goerli"),
    },
  }),
  paths: {
    sources: "src",
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  mocha: {
    timeout: 0,
  },
  external: process.env.HARDHAT_FORK
    ? {
        deployments: {
          // process.env.HARDHAT_FORK will specify the network that the fork is made from.
          // these lines allow it to fetch the deployments from the network being forked from both for node and deploy task
          hardhat: ["deployments/" + process.env.HARDHAT_FORK],
          localhost: ["deployments/" + process.env.HARDHAT_FORK],
        },
      }
    : undefined,

  tenderly: {
    project: "template-ethereum-contracts",
    username: process.env.TENDERLY_USERNAME as string,
  },
  abiExporter: {
    clear: true,
    flat: true,
    only: ["src"],
    except: ["mock", "interfaces", "libraries", "Factory"],
    spacing: 2,
    format: "json",
  },
};

export default config;
