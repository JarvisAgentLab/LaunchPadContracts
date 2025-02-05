import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {execute} from "../utils/utils";
import {factoryParams} from "../config";
import {ethers} from "hardhat";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer, treasury} = await getNamedAccounts();

  const bonding = await deployments.get("bonding");

  // Set admin role to deployer
  await execute(
    hre,
    "factory",
    deployer,
    "grantRole",
    factoryParams.adminRole,
    deployer
  );

  // Set creator role
  await execute(
    hre,
    "factory",
    deployer,
    "grantRole",
    factoryParams.creatorRole,
    bonding.address
  );

  // Set router contract
  await execute(hre, "factory", deployer, "setRouter", bonding.address);
};

deployFunction.dependencies = [];
deployFunction.tags = ["all", "Config", "ConfigFactory", "LaunchPad"];
export default deployFunction;
