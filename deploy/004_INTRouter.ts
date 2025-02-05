import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deploy} from "../utils/utils";
import {routerParams} from "../config";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {deployments} = hre;

  // const factory = await deployments.get("factory");
  // const INT = await deployments.get("INT");
  // const initArgs = [factory.address, INT.address];

  await deploy(hre, "INTRouterLibrary");
};

deployFunction.dependencies = [];
deployFunction.tags = ["INTRouter", "LaunchPad"];
export default deployFunction;
