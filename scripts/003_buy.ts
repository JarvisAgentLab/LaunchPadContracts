import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {treasury} = await getNamedAccounts();

  const token = "0xbf078A8A39B7F29820d7c85e6bCff86312437432";

  await execute(
    hre,
    "bonding",
    treasury,
    "buy",
    ethers.utils.parseEther("1"),
    token
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
