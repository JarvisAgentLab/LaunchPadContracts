import * as hre from "hardhat";
import {execute} from "../utils/utils";
import {bondingParams} from "../config";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {owner} = await getNamedAccounts();

  await execute(
    hre,
    "bonding",
    owner,
    "setGradMarketCap",
    bondingParams.gradMarketCap
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
