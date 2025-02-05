import * as hre from "hardhat";
import {execute} from "../utils/utils";
import {factoryParams} from "../config";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {owner, treasury} = await getNamedAccounts();

  await execute(
    hre,
    "factory",
    owner,
    "setFeeParams",
    treasury,
    factoryParams.buyTax,
    factoryParams.sellTax,
    factoryParams.treasuryFeeRatio
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
