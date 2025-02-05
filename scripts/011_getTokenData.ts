import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {deployer} = await getNamedAccounts();

  const reader = await ethers.getContract("reader");

  console.log(await reader.getTokenData(0, 10));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
