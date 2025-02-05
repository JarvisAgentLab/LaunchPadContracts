import * as hre from "hardhat";
import {deploy, execute, upgrade} from "../utils/utils";

async function main() {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {deployer} = await getNamedAccounts();
  const {read, log} = deployments;

  const toUpgrade: {[instance: string]: string} = {
    bonding: "Bonding",
  };

  for (const instance in toUpgrade) {
    const contractName = toUpgrade[instance];

    const suffix = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "_");

    await upgrade(
      hre,
      instance,
      contractName,
      contractName + "_Impl_" + suffix
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
