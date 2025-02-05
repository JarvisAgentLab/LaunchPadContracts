import * as hre from "hardhat";
import {execute} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {treasury} = await getNamedAccounts();

  const bonding = await deployments.get("bonding");

  const token = {
    name: "Just a chill guy",
    symbol: "CHILLGUY",
    description:
      "I know I’m supposed to be a chill guy and low-key not really care about anything but I’m tired of trying to be someone that I’m not I want you to think of something right now that makes you happy that thing you see the thing that lights you up, Chase that all of your soul chase that because it’s easy to brush off life’s potential and I’m not trying to say that life is easy. In fact I’d argue that the only way that something is meant to be if you’re willing to commit to the difficulty in life otherwise it wasn’t meant to be anything but just a missed opportunity it will be a difficult road but here’s what we come to learn everything of value is difficult",
    image:
      "https://ipfs.io/ipfs/QmaFy59TMnLb4jGgL6LpquyXSxTRXKR4mEfSobUSsPoR46",
    showName: true,
    createdOn: "https://pump.fun",
  };

  await execute(
    hre,
    "INT",
    treasury,
    "approve",
    bonding.address,
    ethers.constants.MaxUint256
  );

  await execute(
    hre,
    "bonding",
    treasury,
    "launch",
    token.name,
    token.symbol,
    [1, 2, 3], // cores array
    token.description,
    token.image,
    [
      "https://x.com/chillguy",
      "https://t.me/chillguy",
      "https://farcaster.com/chillguy",
      "www.chillguy.io",
    ], // urls array
    ethers.utils.parseEther("10.1") // purchaseAmount greater than fee
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
