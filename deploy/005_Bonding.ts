import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deploy, execute} from "../utils/utils";
import {bondingParams} from "../config";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {getNamedAccounts, deployments} = hre;
  const {treasury, owner} = await getNamedAccounts();

  const int = await deployments.get("INT");
  const factory = await deployments.get("factory");
  const tokenFactory = await deployments.get("tokenFactory");
  const lockFactory = await deployments.get("lockFactory");
  const INTRouterLibrary = await deployments.get("INTRouterLibrary");
  const extRouter = await deployments.get("extRouter");
  const oracle = await deployments.get("oracle");
  const initArgs = [
    int.address,
    factory.address,
    treasury,
    bondingParams.fee,
    bondingParams.initialSupply,
    extRouter.address,
    tokenFactory.address,
    lockFactory.address,
    bondingParams.lockedTime,
    oracle.address,
    bondingParams.initialMarketCap,
    bondingParams.gradMarketCap,
  ];

  const bonding = await deploy(
    hre,
    "bonding",
    "Bonding",
    [],
    true,
    "initialize",
    initArgs,
    false,
    {INTRouterLibrary: INTRouterLibrary.address}
  );

  const reader = await deploy(hre, "reader", "TokenDataReader", [
    bonding.address,
  ]);

  // await execute(hre, "bonding", owner, "setOracle", oracle.address);

  // await execute(
  //   hre,
  //   "bonding",
  //   owner,
  //   "setInitialMarketCap",
  //   bondingParams.initialMarketCap
  // );

  // await execute(
  //   hre,
  //   "bonding",
  //   owner,
  //   "setGradMarketCap",
  //   bondingParams.gradMarketCap
  // );
};

deployFunction.dependencies = [];
deployFunction.tags = ["Bonding", "LaunchPad"];
export default deployFunction;
