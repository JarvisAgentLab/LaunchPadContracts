import {setOFT} from "../utils/layerzero.utils";

async function main() {
  await setOFT("int");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
