import {expect} from "chai";
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from "hardhat";
import {Bonding, INTFactory, INT} from "../typechain-types";
import {setupUser, setupUsers} from "./utils";
import {BigNumber, utils} from "ethers";
import {deploy} from "../utils/utils";
import * as hre from "hardhat";
import {mock} from "../typechain-types/src";

const setup = deployments.createFixture(async () => {
  const contracts = {
    bonding: (await ethers.getContract("bonding")) as Bonding,
    factory: (await ethers.getContract("factory")) as INTFactory,
  };

  const {
    owner: ownerAddr,
    treasury: treasuryAddr,
    booster: boosterAddr,
  } = await getNamedAccounts();

  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  const [owner, treasury, booster] = await setupUsers(
    [ownerAddr, treasuryAddr, boosterAddr],
    contracts
  );

  return {
    ...contracts,
    owner,
    treasury,
    booster,
    users,
  };
});

describe("INT Factory", function () {
  let owner: any;
  let treasury: any;
  let booster: any;
  let bonding: Bonding;
  let int: INT;
  let users: any[];
  let factory: INTFactory;
  let newFactory: any;
  let mockTokenA: any;
  let mockTokenB: any;

  before(async function () {
    ({bonding, factory, owner, treasury, booster, users} = await setup());

    // Grant new creator role
    await factory.grantRole(await factory.CREATOR_ROLE(), owner.address);
    // Grant new admin role
    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);

    // Deploy new INT Factory
    const NewINTFactory = await ethers.getContractFactory("INTFactory");
    newFactory = await deploy(hre, "newFactory", "INTFactory", [], true);
    newFactory = (await ethers.getContractAt(
      "INTFactory",
      newFactory.address
    )) as INTFactory;

    // Deploy Mock Token A
    const MockTokenA = await ethers.getContractFactory("INTERC20");
    mockTokenA = await MockTokenA.deploy(
      "Mock Token A",
      "MTA",
      utils.parseEther("1000000"),
      users[0].address
    );
    mockTokenA.deployed();

    // Deploy Mock Token B
    const MockTokenB = await ethers.getContractFactory("INTERC20");
    mockTokenB = await MockTokenB.deploy(
      "Mock Token B",
      "MTB",
      utils.parseEther("1000000"),
      users[0].address
    );
    mockTokenB.deployed();
  });

  describe("Initialize", function () {
    it("Should revert when trying to initialize the contract again", async function () {
      await expect(
        factory.initialize(
          treasury.address,
          BigNumber.from(10),
          BigNumber.from(10),
          BigNumber.from(10)
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
    it("Should revert when set buy fee too high", async function () {
      await expect(
        newFactory.initialize(
          treasury.address,
          BigNumber.from(101),
          BigNumber.from(10),
          BigNumber.from(10)
        )
      ).to.be.revertedWithCustomError(newFactory, "BuyFeeTooHigh");
    });
    it("Should revert when set sell fee too high", async function () {
      await expect(
        newFactory.initialize(
          treasury.address,
          BigNumber.from(10),
          BigNumber.from(101),
          BigNumber.from(10)
        )
      ).to.be.revertedWithCustomError(newFactory, "SellFeeTooHigh");
    });
    it("Should revert when set treasury fee too high", async function () {
      await expect(
        newFactory.initialize(
          treasury.address,
          BigNumber.from(10),
          BigNumber.from(10),
          BigNumber.from(101)
        )
      ).to.be.revertedWithCustomError(newFactory, "TreasuryFeeRatioTooHigh");
    });
  });
  describe("Create Pair", function () {
    it("Should revert when general user try to create pair", async function () {
      await expect(
        users[0].factory.createPair(mockTokenA.address, mockTokenB.address)
      ).to.be.revertedWith(
        `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
          "CREATOR_ROLE"
        )}`
      );
    });
    it("Should revert when creating pair with zero address", async function () {
      await expect(
        factory.createPair(mockTokenA.address, ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(factory, "TokenIsZeroAddress");
      await expect(
        factory.createPair(ethers.constants.AddressZero, mockTokenB.address)
      ).to.be.revertedWithCustomError(factory, "TokenIsZeroAddress");
    });
  });
  describe("All Pairs Length", function () {
    it("Should return 0 when there is no pair", async function () {
      expect(await newFactory.allPairsLength()).to.be.equal(0);
    });
  });
  describe("Set Fee Params", function () {
    it("Should set new fee params successfully", async function () {
      let oldTreasury = await factory.treasury();
      let oldBuyFee = await factory.buyFee();
      let oldSellFee = await factory.sellFee();
      let oldTreasuryFeeRatio = await factory.treasuryFeeRatio();

      let newTreasury = users[5].address;
      let newBuyFee = oldBuyFee.eq(100) ? 99 : oldBuyFee.add("1");
      let newSellFee = oldSellFee.eq(100) ? 99 : oldSellFee.add("1");
      let newTreasuryFeeRatio = oldTreasuryFeeRatio.eq(100)
        ? 99
        : oldTreasuryFeeRatio.add("1");

      await owner.factory.setFeeParams(
        newTreasury,
        newBuyFee,
        newSellFee,
        newTreasuryFeeRatio
      );

      expect(await factory.treasury()).to.be.equal(newTreasury);
      expect(await factory.buyFee()).to.be.equal(newBuyFee);
      expect(await factory.sellFee()).to.be.equal(newSellFee);
      expect(await factory.treasuryFeeRatio()).to.be.equal(newTreasuryFeeRatio);

      // Revert back to old params
      await owner.factory.setFeeParams(
        oldTreasury,
        oldBuyFee,
        oldSellFee,
        oldTreasuryFeeRatio
      );
    });
    it("Should revert when general user sets fee params", async function () {
      await expect(
        users[1].factory.setFeeParams(
          users[5].address,
          BigNumber.from(10),
          BigNumber.from(10),
          BigNumber.from(10)
        )
      ).to.be.revertedWith(
        `AccessControl: account ${users[1].address.toLowerCase()} is missing role ${ethers.utils.id(
          "ADMIN_ROLE"
        )}`
      );
    });
    it("Should revert when set treasury address to zero address", async function () {
      await expect(
        owner.factory.setFeeParams(
          ethers.constants.AddressZero,
          BigNumber.from(10),
          BigNumber.from(10),
          BigNumber.from(10)
        )
      ).to.be.revertedWithCustomError(factory, "TreasuryIsZeroAddress");
    });
    it("Should revert when set buy fee too high", async function () {
      await expect(
        owner.factory.setFeeParams(
          treasury.address,
          BigNumber.from(101),
          BigNumber.from(10),
          BigNumber.from(10)
        )
      ).to.be.revertedWithCustomError(factory, "BuyFeeTooHigh");
    });
    it("Should revert when set sell fee too high", async function () {
      await expect(
        owner.factory.setFeeParams(
          treasury.address,
          BigNumber.from(10),
          BigNumber.from(101),
          BigNumber.from(10)
        )
      ).to.be.revertedWithCustomError(factory, "SellFeeTooHigh");
    });
    it("Should revert when set treasury fee too high", async function () {
      await expect(
        owner.factory.setFeeParams(
          treasury.address,
          BigNumber.from(10),
          BigNumber.from(10),
          BigNumber.from(101)
        )
      ).to.be.revertedWithCustomError(factory, "TreasuryFeeRatioTooHigh");
    });
  });
  describe("Set Router", function () {
    it("Should set new router successfully", async function () {
      let oldRouter = await factory.router();
      let newRouter = users[5].address;
      await owner.factory.setRouter(newRouter);
      expect(await factory.router()).to.be.equal(newRouter);

      // Revert back to old router
      await owner.factory.setRouter(oldRouter);
    });
    it("Should revert when general user sets router", async function () {
      await expect(
        users[0].factory.setRouter(users[5].address)
      ).to.be.revertedWith(
        `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
          "ADMIN_ROLE"
        )}`
      );
    });
  });
});
