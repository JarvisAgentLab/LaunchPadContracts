import * as hre from "hardhat";
import {endpointV2} from "../config/endpoints.config";
import {execute} from "../utils/utils";

async function main() {
  const {getNamedAccounts, ethers} = hre;
  const {treasury} = await getNamedAccounts();

  const from = treasury;
  const adapter = await ethers.getContract("INTOFTAdapter", from);

  const dstEid = endpointV2.base_sepolia.eid;
  const amount = ethers.utils.parseEther("100");
  const to = ethers.utils.defaultAbiCoder.encode(["address"], [from]);

  const sendParams = {
    dstEid,
    to,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x0003",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  const fee = await adapter.quoteSend(sendParams, false);

  //   await adapter.send(sendParams, fee, from, {value: fee.nativeFee});
  await execute(hre, "INTOFTAdapter", from, "send", sendParams, fee, from, {
    value: fee.nativeFee,
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
