import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deploy} from "../utils/utils";
import {factoryParams} from "../config";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {getNamedAccounts} = hre;
  const {treasury} = await getNamedAccounts();

  const initArgs = [
    treasury,
    factoryParams.buyTax,
    factoryParams.sellTax,
    factoryParams.treasuryFeeRatio,
  ];

  await deploy(hre, "factory", "INTFactory", [], true, "initialize", initArgs);
  await deploy(hre, "tokenFactory", "INTERC20Factory", [], true);
  await deploy(hre, "lockFactory", "LockFactory", [], true);
};

deployFunction.dependencies = [];
deployFunction.tags = ["INTFactory", "LaunchPad"];
export default deployFunction;
