import {BigNumber, utils} from "ethers";

export const factoryParams = {
  buyTax: BigNumber.from("1"), // 1%
  sellTax: BigNumber.from("1"), // 1%
  treasuryFeeRatio: BigNumber.from("50"), // 50%
  creatorRole: utils.id("CREATOR_ROLE"),
  adminRole: utils.id("ADMIN_ROLE"),
};

export const routerParams = {
  executorRole: utils.id("EXECUTOR_ROLE"),
};

export const bondingParams = {
  fee: 0, // 18 decimals
  // token will handle decimals
  initialSupply: utils.parseEther("1000000000"), // 18 decimals
  // extRouter: "0xDaaD2C7cD07fe99DF199104F2F1b7d032f969F9D",
  extRouter: "0x9f39E84C9694dE1290beD61ACfEA6061469b02eD",
  // in USD value and 18 decimals
  boostStageThresholds: [
    utils.parseEther("50000"),
    utils.parseEther("500000"),
    utils.parseEther("2000000"),
  ],
  lockedTime: BigNumber.from("31536000"), // 365 days
  initialMarketCap: utils.parseEther("1"), // 18 decimals
  gradMarketCap: utils.parseEther("50000"), // 18 decimals
};

export const intParams = {
  l1MintCap: utils.parseEther("1000000000"),
  l2MintCap: utils.parseEther("500000000"),
};

export const intAdapterParams = {
  bridgeRole: utils.id("BRIDGE_ROLE"),
};
