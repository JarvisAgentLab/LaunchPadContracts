import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deploy} from "../utils/utils";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  await deploy(hre, "proxyAdmin", "ProxyAdmin2Step", []);
};

deployFunction.dependencies = [];
deployFunction.tags = ["ProxyAdmin"];
export default deployFunction;
