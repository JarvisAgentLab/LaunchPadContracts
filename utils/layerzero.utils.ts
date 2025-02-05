import {getNamedAccounts, network, deployments, ethers} from "hardhat";
import {Options} from "@layerzerolabs/lz-v2-utilities";
import {getNetworkName} from "hardhat-deploy/dist/src/utils";
import {config} from "../config/adapter.config";
import {
  SendType,
  mainnet,
  testnet,
  endpointV2,
} from "../config/endpoints.config";
import {getDeploymentAddresses} from "./loadDeployment";

const {read, execute, log, catchUnknownSigner} = deployments;

export function getNetworks(networkName: string): string[] {
  if (mainnet.includes(networkName)) {
    return mainnet;
  }
  if (testnet.includes(networkName)) {
    return testnet;
  }
  throw new Error(`${networkName} network is not supported`);
}

export function getEndpointId(networkName: string): number {
  return endpointV2[networkName].eid;
}

export function getOption(gasLimit: string): string {
  const option = Options.newOptions().addExecutorLzReceiveOption(gasLimit, "0");
  return option.toHex();
}

export async function setOFT(symbol: string) {
  const networkName = getNetworkName(network);

  if (!config.hasOwnProperty(networkName)) {
    console.log(`${networkName} Network is not configured\n`);
    return;
  }

  if (!config[networkName].hasOwnProperty(symbol)) {
    console.log(`${networkName}:${symbol} is not configured\n`);
    return;
  }

  const {deployer} = await getNamedAccounts();

  const contract: string = config[networkName][symbol].contract;

  let setOptionArgs = [];
  const networks = getNetworks(networkName);
  for (let index = 0; index < networks.length; index++) {
    const targetNet = networks[index];
    if (targetNet == networkName) continue;

    const targetDeployments = getDeploymentAddresses(targetNet);

    if (!targetDeployments.hasOwnProperty(contract)) {
      console.log(`${targetNet} ${contract} not deployed!\n`);
      continue;
    }
    const peer = ethers.utils.defaultAbiCoder.encode(
      ["address"],
      [targetDeployments[contract]]
    );

    const endpointId = getEndpointId(targetNet);

    const currentPeer = await read(contract, "peers", endpointId);
    if (peer != currentPeer) {
      console.log(`${symbol} setPeer`);
      console.log(`contract:          ${contract}`);
      console.log(`target network:    ${targetNet}`);
      console.log(`eid:               ${endpointId}`);
      console.log(`peer:              ${peer}\n`);

      await catchUnknownSigner(
        execute(
          contract,
          {from: deployer, log: true},
          "setPeer",
          endpointId,
          peer
        )
      );
    }

    const sendOption = getOption(config[targetNet][symbol].sendMinGas);
    const currentSendOption = await read(
      contract,
      "enforcedOptions",
      endpointId,
      SendType.SEND
    );
    if (sendOption != currentSendOption) {
      console.log(`${symbol} setEnforcedOptions`);
      console.log(`contract:          ${contract}`);
      console.log(`target network:    ${targetNet}`);
      console.log(`eid:               ${endpointId}`);
      console.log(`sendType:           ${SendType.SEND}\n`);
      console.log(`options:           ${sendOption}\n`);
      setOptionArgs.push([endpointId, SendType.SEND, sendOption]);
    }

    const sendCallOption = getOption(config[targetNet][symbol].sendCallMinGas);
    const currentSendCallOption = await read(
      contract,
      "enforcedOptions",
      endpointId,
      SendType.SEND_AND_CALL
    );
    if (sendCallOption != currentSendCallOption) {
      console.log(`${symbol} setEnforcedOptions`);
      console.log(`contract:          ${contract}`);
      console.log(`target network:    ${targetNet}`);
      console.log(`eid:               ${endpointId}`);
      console.log(`sendType:           ${SendType.SEND_AND_CALL}\n`);
      console.log(`options:           ${sendCallOption}\n`);
      setOptionArgs.push([endpointId, SendType.SEND_AND_CALL, sendCallOption]);
    }
  }

  if (setOptionArgs.length > 0) {
    await catchUnknownSigner(
      execute(
        contract,
        {from: deployer, log: true},
        "setEnforcedOptions",
        setOptionArgs
      )
    );
  }
}
