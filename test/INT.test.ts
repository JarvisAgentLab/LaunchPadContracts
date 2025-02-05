import {expect} from "chai";
import {
  ethers,
  network,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from "hardhat";
import {L2INT} from "../typechain-types";
import {setupUsers} from "./utils";

const setup = deployments.createFixture(async () => {
  const contracts = {
    int: (await ethers.getContract("INT")) as L2INT,
  };

  const {
    owner: ownerAddr,
    treasury: treasuryAddr,
    booster: boosterAddr,
  } = await getNamedAccounts();

  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  const [owner] = await setupUsers(
    [ownerAddr, treasuryAddr, boosterAddr],
    contracts
  );

  return {
    ...contracts,
    owner,
    users,
  };
});

describe("INT Token", function () {
  let owner: any;
  let int: L2INT;
  let users: any[];

  before(async function () {
    ({int, owner, users} = await setup());
  });

  describe("Initialization", function () {
    it("Should revert when trying to initialize again", async function () {
      await expect(
        int.initialize(ethers.utils.parseEther("1000000000"))
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("setMintCap", function () {
    it("Should set mint successfully", async function () {
      const mintCap = await int.mintCap();
      await owner.int._setMintCap(mintCap.add("1"));
      expect(await int.mintCap()).to.equal(mintCap.add("1"));
      // Reset mint cap
      await owner.int._setMintCap(mintCap);
    });
    it("Should revert when general user tries to set mint cap", async function () {
      const amount = ethers.utils.parseEther("1000");
      await expect(users[5].int._setMintCap(amount)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
    it("Should revert when set the same mint cap", async function () {
      const mintCap = await int.mintCap();
      await expect(
        owner.int._setMintCap(mintCap)
      ).to.be.revertedWithCustomError(int, "SameMintCap");
    });
  });

  describe("mint", function () {
    let bridger: any;

    before(async function () {
      bridger = users[10];
      // Set bridge role
      await owner.int.grantRole(await int.BRIDGE_ROLE(), bridger.address);
    });

    after(async function () {
      // Revoke bridge role
      await owner.int.revokeRole(await int.BRIDGE_ROLE(), bridger.address);
    });

    it("Should mint INT to user successfully", async function () {
      const mintCap = await int.mintCap();

      // Increase mint cap
      await owner.int._setMintCap(mintCap.mul(2));

      // Mint
      const amount = ethers.utils.parseEther("1000");
      await expect(
        bridger.int.mint(users[11].address, amount)
      ).to.changeTokenBalance(int, users[11].address, amount);

      // Reset mint cap
      await owner.int._setMintCap(mintCap);
      // Burn minted INT
      await bridger.int.burn(users[11].address, amount);
    });

    it("Should revert when general user tries to mint", async function () {
      const amount = ethers.utils.parseEther("1000");
      await expect(
        users[0].int.mint(users[0].address, amount)
      ).to.be.revertedWith(
        `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
          "BRIDGE_ROLE"
        )}`
      );
    });

    it("Should revert when mint cap is reached", async function () {
      const mintCap = await int.mintCap();
      const totalSupply = await int.totalSupply();
      const amount = mintCap.sub(totalSupply).add(1);

      await expect(
        bridger.int.mint(users[11].address, amount)
      ).to.be.revertedWithCustomError(int, "ExceedMintCap");
    });
  });

  describe("burn", function () {
    let bridger: any;

    before(async function () {
      bridger = users[10];
      // Set bridge role
      await owner.int.grantRole(await int.BRIDGE_ROLE(), bridger.address);
    });

    after(async function () {
      // Revoke bridge role
      await owner.int.revokeRole(await int.BRIDGE_ROLE(), bridger.address);
    });

    it("Should burn INT from treasury successfully", async function () {
      const amount = ethers.utils.parseEther("100");
      const user = users[5];

      const mintCap = await int.mintCap();
      // Increase mint cap
      await owner.int._setMintCap(mintCap.mul(2));

      // Mint at first
      await bridger.int.mint(user.address, amount);
      // Burn
      await expect(
        bridger.int.burn(user.address, amount)
      ).to.changeTokenBalance(int, user.address, amount.mul(-1));

      // Reset mint cap
      await owner.int._setMintCap(mintCap);
    });

    it("Should revert when general user tries to burn", async function () {
      const amount = ethers.utils.parseEther("1000");
      await expect(
        users[0].int.burn(users[0].address, amount)
      ).to.be.revertedWith(
        `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
          "BRIDGE_ROLE"
        )}`
      );
    });
  });
});
