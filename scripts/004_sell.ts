import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {treasury, deployer} = await getNamedAccounts();

  const bonding = await ethers.getContract("bonding", treasury);
  const token = await ethers.getContractAt(
    "INTERC20",
    "0xbf078A8A39B7F29820d7c85e6bCff86312437432",
    await ethers.getSigner(treasury)
  );

  await token.approve(bonding.address, ethers.constants.MaxUint256);

  console.log(ethers.utils.formatEther(await token.balanceOf(treasury)));

  // console.log(await bonding.tokenInfo(token.address));
  // console.log(await bonding.getUserTokens(treasury));
  // console.log(await bonding.profile(treasury));

  await bonding.sell(ethers.utils.parseEther("1000"), token.address);

  // await execute(
  //   hre,
  //   "bonding",
  //   treasury,
  //   "sell",
  //   ethers.utils.parseEther("10000"),
  //   token.address,
  // );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
