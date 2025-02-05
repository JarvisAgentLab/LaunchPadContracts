import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deploy, execute} from "../utils/utils";
import {bondingParams} from "../config";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {deployer} = await getNamedAccounts();

  if (!hre.network.live) {
    await deploy(hre, "extRouter", "MockExtRouter", []);
    await deploy(hre, "oracle", "MockOracle", []);

    await execute(
      hre,
      "oracle",
      deployer,
      "setAssetPrice",
      ethers.utils.parseEther("1")
    );
  } else {
    const {deployments} = hre;
    const {read} = deployments;

    const extRouter = bondingParams.extRouter;
    await deployments.save("extRouter", {
      address: extRouter,
      abi: (await hre.artifacts.readArtifact("IExtRouter")).abi,
    });

    const INT = await deployments.get("INT");
    const USDC = await deployments.get("USDC");
    const pair = await read(
      "extRouter",
      "pairFor",
      [INT.address, USDC.address],
      1
    );

    console.log(pair);

    await deploy(hre, "oracle", "UniV2TWAP", [INT.address, pair.pair]);
  }
};

deployFunction.dependencies = [];
deployFunction.tags = ["ExtRouter", "LaunchPad"];
export default deployFunction;
