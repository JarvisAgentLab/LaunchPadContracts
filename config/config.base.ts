import {BigNumber, utils} from "ethers";

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
  fee: 0, // 18 decimals
  initialSupply: utils.parseEther("1000000000"), // 18 decimals
  extRouter: "0x1AD2e9e4c06F29B0e9015904d9CB7FD0D087aa6B",
  // in USD value and 18 decimals
  boostStageThresholds: [
    utils.parseEther("50000"),
    utils.parseEther("2000000"),
    utils.parseEther("10000000"),
  ],
  lockedTime: BigNumber.from("31536000"), // 365 days
  initialMarketCap: utils.parseEther("2500"), // 18 decimals
  gradMarketCap: utils.parseEther("150000"), // 18 decimals
};

export const intParams = {
  l1MintCap: utils.parseEther("1000000000"),
  l2MintCap: utils.parseEther("300000000"),
};

export const intAdapterParams = {
  bridgeRole: utils.id("BRIDGE_ROLE"),
};
