import * as hre from "hardhat";
import {execute} from "../utils/utils";
import {BigNumber} from "ethers";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {booster} = await getNamedAccounts();

  const bonding = await deployments.get("bonding");
  const int = await deployments.get("INT");
  const extRouterDeployments = await deployments.get("extRouter");
  const extRouter = await ethers.getContractAt(
    "IExtRouter",
    extRouterDeployments.address
  );

  const token = "0xd84417228B532e40006bE796c239AB5fb6b2bfcd";

  const tokenAmount = ethers.utils.parseEther("100000000");
  const assetAmount = ethers.utils.parseEther("20000");

  // const quote = await extRouter.quoteAddLiquidity(
  //   1,
  //   [token, int.address],
  //   [tokenAmount, assetAmount]
  // );

  // console.log(quote);

  const quote = {
    _amountIn: [tokenAmount, ethers.utils.parseEther("750")],
    liquidity: BigNumber.from("273861278752583056728484"),
  };

  await execute(
    hre,
    "bonding",
    booster,
    "boost2",
    token,
    tokenAmount,
    quote._amountIn[1].mul(105).div(100), // 5% slippage,
    tokenAmount,
    0,
    quote.liquidity.mul(95).div(100),
    Math.floor(Date.now() / 1000) + 600
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
