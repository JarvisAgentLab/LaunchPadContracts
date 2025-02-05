import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {treasury} = await getNamedAccounts();

  const extRouter = await deployments.get("extRouter");
  const USDC = await deployments.get("USDC");
  const INT = await deployments.get("INT");

  await execute(
    hre,
    "USDC",
    treasury,
    "approve",
    extRouter.address,
    hre.ethers.constants.MaxUint256
  );

  await execute(
    hre,
    "INT",
    treasury,
    "approve",
    extRouter.address,
    hre.ethers.constants.MaxUint256
  );

  await execute(
    hre,
    "extRouter",
    treasury,
    "addLiquidity",
    1,
    [USDC.address, INT.address],
    [ethers.utils.parseUnits("5000", 6), ethers.utils.parseEther("500000")],
    [0, 0],
    0,
    treasury,
    Math.floor(Date.now() / 1000) + 600
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
