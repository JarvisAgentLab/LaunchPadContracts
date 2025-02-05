import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {deployer} = await getNamedAccounts();

  const booster = "0x95E111E87847Cdb3E3e9Bf16607A36099115dEC7";

  // Set admin role
  await execute(
    hre,
    "bonding",
    deployer,
    "grantRole",
    ethers.utils.id("BOOSTER_ROLE"),
    booster
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
