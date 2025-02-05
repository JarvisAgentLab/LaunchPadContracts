import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {booster} = await getNamedAccounts();

  const bonding = await ethers.getContract("bonding");
  const oracle = await ethers.getContract("oracle");

  const token = {
    name: "Lucky Luigi",
    symbol: "LUIGI",
    description: "",
    image:
      "https://ipfs.io/ipfs/Qmc1pd6DjHPbNNcrzhCHkXEQRfpoHCg2pVqkZHugChuKhq",
    showName: true,
    createdOn: "https://pump.fun",
  };

  const tokenAmount = ethers.utils.parseEther("800000000");

  // Get boost stage 1 threshold
  const threshold = await bonding.boostStageThresholds(1);

  // Get current asset price from oracle
  const assetPrice = await oracle.callStatic.getAssetPrice();

  // Calculate required liquidity amount
  // threshold / (assetPrice * 2) since liquidity value is 2x asset amount
  const requiredLiquidity = threshold
    .mul(ethers.constants.WeiPerEther)
    .div(assetPrice.mul(2));

  const assetAmount = requiredLiquidity.mul(101).div(100);

  await execute(
    hre,
    "bonding",
    booster,
    "boost1",
    token.name,
    token.symbol,
    [1, 2, 3], // cores array
    token.description,
    token.image,
    [
      "https://x.com/luigi",
      "https://t.me/luigi",
      "https://farcaster.com/luigi",
      "www.luigi.io",
    ], // urls array
    tokenAmount,
    assetAmount,
    tokenAmount,
    assetAmount,
    0,
    Math.floor(Date.now() / 1000) + 600
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
