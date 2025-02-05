import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deploy, execute} from "../utils/utils";
import {intParams, intAdapterParams} from "../config";
import {endpointV2} from "../config/endpoints.config";
import {getNetworkName} from "hardhat-deploy/dist/src/utils";
import {setOFT} from "../utils/layerzero.utils";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {getNamedAccounts, network, deployments} = hre;
  const {owner, deployer, treasury} = await getNamedAccounts();
  const {read} = deployments;

  const initArgs = [treasury, intParams.l1MintCap];

  const int = await deploy(
    hre,
    "INT",
    "INTPermit",
    [],
    true,
    "initialize",
    initArgs
  );

  // Only for upgrade
  // await execute(hre, "INT", deployer, "upgrade");

  if (network.live) {
    const intAdapterArgs = [
      int.address,
      endpointV2[getNetworkName(network)].address,
    ];
    const intAdapter = await deploy(
      hre,
      "INTOFTAdapter",
      "INTOFTAdapter",
      intAdapterArgs,
      true,
      "initialize",
      [int.address]
    );

    // Set bridge role
    await execute(
      hre,
      "INT",
      deployer,
      "grantRole",
      intAdapterParams.bridgeRole,
      intAdapter.address
    );
  }
};

deployFunction.dependencies = ["ProxyAdmin2Step"];
deployFunction.tags = ["INT"];
export default deployFunction;
