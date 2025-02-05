import {BigNumber, utils, constants} from "ethers";

export const factoryParams = {
  buyTax: BigNumber.from("1"), // 1%
  sellTax: BigNumber.from("1"), // 1%
  treasuryFeeRatio: BigNumber.from("80"), // 80%
  creatorRole: utils.id("CREATOR_ROLE"),
  adminRole: utils.id("ADMIN_ROLE"),
};

export const routerParams = {
  executorRole: utils.id("EXECUTOR_ROLE"),
};

export const bondingParams = {
  fee: utils.parseEther("10"), // 18 decimals
  // token will handle decimals
  initialSupply: utils.parseEther("1000000000"), // 18 decimals
  extRouter: constants.AddressZero,
  // in USD value and 18 decimals
  boostStageThresholds: [
    utils.parseEther("50000"),
    utils.parseEther("500000"),
    utils.parseEther("2000000"),
  ],
  lockedTime: BigNumber.from("31536000"), // 365 days
  initialMarketCap: utils.parseEther("6000"), // 18 decimals
  gradMarketCap: utils.parseEther("50000"), // 18 decimals
};

export const intParams = {
  l1MintCap: utils.parseEther("1000000000"),
  l2MintCap: utils.parseEther("500000000"),
};

export const intAdapterParams = {
  bridgeRole: utils.id("BRIDGE_ROLE"),
};
