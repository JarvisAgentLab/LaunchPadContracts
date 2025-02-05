import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {deployer} = await getNamedAccounts();

  const bonding = await ethers.getContract("bonding");

  // const token = "0xA54f83fAf844b7Edab64Eb56141EcA4183b63aAb";
  const token = "0xd84417228B532e40006bE796c239AB5fb6b2bfcd";

  // console.log(await bonding.tokenInfo(token));

  console.log(await bonding.callStatic.calculateMarketCap(token));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
