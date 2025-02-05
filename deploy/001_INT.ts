import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deploy, execute} from "../utils/utils";
import {intParams, intAdapterParams} from "../config";
import {endpointV2} from "../config/endpoints.config";
import {setOFT} from "../utils/layerzero.utils";

const deployFunction: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const {getNamedAccounts, network, ethers, deployments} = hre;
  const {deployer, treasury} = await getNamedAccounts();
  const {read} = deployments;

  const initArgs = [intParams.l2MintCap];

  const int = await deploy(
    hre,
    "INT",
    "L2INTPermit",
    [],
    true,
    "initialize",
    initArgs
  );

  // Only for upgrade
  // await execute(hre, "INT", deployer, "upgrade");

  if (network.live && int.newlyDeployed) {
    const intAdapterArgs = [int.address, endpointV2[network.name].address];
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
  } else {
    // for local test
    await execute(
      hre,
      "INT",
      deployer,
      "grantRole",
      intAdapterParams.bridgeRole,
      deployer
    );

    const totalSupply = ethers.utils.parseEther("1000000000");

    await execute(hre, "INT", deployer, "_setMintCap", totalSupply);
    await execute(hre, "INT", deployer, "mint", treasury, totalSupply);
  }
};

deployFunction.dependencies = ["ProxyAdmin2Step"];
deployFunction.tags = ["INT"];
export default deployFunction;
