import fs from "fs";
import path from "path";
import {getNetworkName} from "hardhat-deploy/dist/src/utils";
import * as hre from "hardhat";
import {BigNumber} from "ethers";

// Define the base configuration type
interface Config {
  factoryParams: FactoryParams;
  routerParams: RouterParams;
  bondingParams: BondingParams;
  intParams: IntParams;
  intAdapterParams: IntAdapterParams;
}

export interface FactoryParams {
  buyTax: BigNumber;
  sellTax: BigNumber;
  treasuryFeeRatio: BigNumber;
  creatorRole: string;
  adminRole: string;
}

export interface RouterParams {
  executorRole: string;
}

export interface BondingParams {
  fee: BigNumber;
  initialSupply: BigNumber;
  extRouter: string;
  boostStageThresholds: BigNumber[];
  lockedTime: BigNumber;
  initialMarketCap: BigNumber;
  gradMarketCap: BigNumber;
}

export interface IntParams {
  l1MintCap: BigNumber;
  l2MintCap: BigNumber;
}

export interface IntAdapterParams {
  bridgeRole: string;
}

// Load the default configuration
const defaultConfig: Config = require("./config.default.ts");

const network = getNetworkName(hre.network);

// Construct the path for the environment-specific config file
const envConfigPath = path.join(__dirname, `config.${network}.ts`);

// Initialize the final configuration object
let config: Config = {...defaultConfig};

// If an environment-specific config file exists, merge it with the default config
if (fs.existsSync(envConfigPath)) {
  const envConfig: Partial<Config> = require(envConfigPath);
  config = {...config, ...envConfig};
}

// Export the final configuration
export default config;
export const {
  factoryParams,
  routerParams,
  bondingParams,
  intParams,
  intAdapterParams,
} = config;
