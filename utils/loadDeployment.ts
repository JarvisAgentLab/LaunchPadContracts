import path from "path";
import fs from "fs";

export function getDeploymentAddresses(networkName: string) {
  const DEPLOYMENT_PATH = path.resolve("deployments");

  let folderName = networkName;
  if (networkName === "hardhat") {
    folderName = "localhost";
  }

  let rtnAddresses: any = {};
  const networkFolderName = fs
    .readdirSync(DEPLOYMENT_PATH)
    .filter((f) => f === folderName)[0];
  if (networkFolderName === undefined) {
    console.log(`${folderName} not deployed!`);
    return rtnAddresses;
  }

  const networkFolderPath = path.resolve(DEPLOYMENT_PATH, folderName);
  const files = fs
    .readdirSync(networkFolderPath)
    .filter((f) => f.includes(".json"));
  files.forEach((file) => {
    const filepath: string = path.resolve(networkFolderPath, file);
    const jsonString: Buffer = fs.readFileSync(filepath);
    const data = JSON.parse(jsonString.toString());
    const contractName = file.split(".")[0];
    rtnAddresses[contractName] = data.address;
  });

  return rtnAddresses;
}
