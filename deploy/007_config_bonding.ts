import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {execute} from "../utils/utils";
import {bondingParams} from "../config";
import {ethers} from "hardhat";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer, booster} = await getNamedAccounts();

  // Set boost stage threshold
  await execute(
    hre,
    "bonding",
    deployer,
    "setBoostStageThresholds",
    bondingParams.boostStageThresholds
  );

  // Set admin role
  await execute(
    hre,
    "bonding",
    deployer,
    "grantRole",
    ethers.utils.id("BOOSTER_ROLE"),
    booster
  );
};

deployFunction.dependencies = [];
deployFunction.tags = ["all", "Config", "ConfigFactory", "LaunchPad"];
export default deployFunction;
