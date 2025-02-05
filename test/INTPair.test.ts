import {expect, use} from "chai";
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from "hardhat";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import {
  Bonding,
  INTERC20,
  INTFactory,
  INT,
  Lock,
  IExtRouter,
  IERC20,
  MockOracle,
  TokenDataReader,
  INTPair,
} from "../typechain-types";
import {setupUser, setupUsers} from "./utils";
import {BigNumber, utils} from "ethers";

const setup = deployments.createFixture(async () => {
  const contracts = {
    bonding: (await ethers.getContract("bonding")) as Bonding,
    int: (await ethers.getContract("INT")) as INT,
    extRouter: (await ethers.getContract("extRouter")) as IExtRouter,
    factory: (await ethers.getContract("factory")) as INTFactory,
    oracle: (await ethers.getContract("oracle")) as MockOracle,
    reader: (await ethers.getContract("reader")) as TokenDataReader,
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

describe("INT Pair", function () {
  let owner: any;
  let treasury: any;
  let bonding: Bonding;
  let int: INT;
  let users: any[];
  let lp: IERC20;
  let factory: INTFactory;
  let pair: INTPair;
  let mockTokenA: INTERC20;
  let mockTokenB: INTERC20;

  before(async function () {
    ({bonding, factory, int, owner, treasury, users} = await setup());

    // Deploy Mock Token A
    const MockTokenA = await ethers.getContractFactory("INTERC20");
    mockTokenA = (await MockTokenA.deploy(
      "Mock Token A",
      "MTA",
      utils.parseEther("1000000"),
      owner.address
    )) as INTERC20;
    mockTokenA.deployed();

    // Deploy Mock Token B
    const MockTokenB = await ethers.getContractFactory("INTERC20");
    mockTokenB = (await MockTokenB.deploy(
      "Mock Token B",
      "MTB",
      utils.parseEther("1000000"),
      owner.address
    )) as INTERC20;
    mockTokenB.deployed();

    // Deploy new pair
    let PairFactory = await ethers.getContractFactory("INTPair");
    pair = (await PairFactory.deploy(
      factory.address,
      mockTokenA.address,
      mockTokenB.address
    )) as INTPair;
    await pair.deployed();
  });

  describe("Deployment", function () {
    it("Should revert if factory address is zero", async function () {
      let PairFactory = await ethers.getContractFactory("INTPair");
      await expect(
        PairFactory.deploy(
          ethers.constants.AddressZero,
          mockTokenA.address,
          mockTokenB.address
        )
      ).to.be.revertedWithCustomError(pair, "FactoryIsZeroAddress");
    });
    it("Should revert if tokenA address is zero", async function () {
      let PairFactory = await ethers.getContractFactory("INTPair");
      await expect(
        PairFactory.deploy(
          factory.address,
          ethers.constants.AddressZero,
          mockTokenB.address
        )
      ).to.be.revertedWithCustomError(pair, "TokenIsZeroAddress");
      await expect(
        PairFactory.deploy(
          factory.address,
          mockTokenA.address,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWithCustomError(pair, "TokenIsZeroAddress");
    });
  });
  describe("Mint", function () {
    it("Should revert if caller is not router", async function () {
      await expect(pair.mint(100, 100)).to.be.revertedWithCustomError(
        pair,
        "CallerIsNotRouter"
      );
    });
  });
  describe("Swap", function () {
    it("Should revert if caller is not router", async function () {
      await expect(pair.swap(10, 10, 5, 5)).to.be.revertedWithCustomError(
        pair,
        "CallerIsNotRouter"
      );
    });
  });
  describe("Approval", function () {
    let oldRouter: any;

    before(async function () {
      oldRouter = await factory.router();
      // Set new router
      await factory.setRouter(owner.address);
    });
    after(async function () {
      // Set old router
      await factory.setRouter(oldRouter);
    });

    it("Should approve successfully", async function () {
      const spender = users[5].address;
      const newApproval = 100;
      const beforeTokenAllowance = await mockTokenA.allowance(
        pair.address,
        spender
      );
      // Approve
      await pair.approval(spender, mockTokenA.address, newApproval);
      const afterTokenAllowance = await mockTokenA.allowance(
        pair.address,
        spender
      );
      expect(afterTokenAllowance).to.be.equal(
        beforeTokenAllowance.add(newApproval)
      );
    });
    it("Should revert if caller is not router", async function () {
      const signer = await ethers.getSigner(users[0].address);
      await expect(
        pair.connect(signer).approval(users[0].address, mockTokenA.address, 100)
      ).to.be.revertedWithCustomError(pair, "CallerIsNotRouter");
    });
    it("Should revert if recipient address is zero", async function () {
      await expect(
        pair.approval(ethers.constants.AddressZero, mockTokenA.address, 100)
      ).to.be.revertedWithCustomError(pair, "RecipientIsZeroAddress");
    });
    it("Should revert if token address is zero", async function () {
      await expect(
        pair.approval(users[0].address, ethers.constants.AddressZero, 100)
      ).to.be.revertedWithCustomError(pair, "TokenIsZeroAddress");
    });
  });
  describe("Transfer Asset", function () {
    it("Should revert if caller is not router", async function () {
      await expect(
        pair.transferAsset(users[0].address, 100)
      ).to.be.revertedWithCustomError(pair, "CallerIsNotRouter");
    });
    it("Should revert if recipient address is zero", async function () {
      const oldRouter = await factory.router();
      // Set new router
      await factory.setRouter(owner.address);

      await expect(
        pair.transferAsset(ethers.constants.AddressZero, 100)
      ).to.be.revertedWithCustomError(pair, "RecipientIsZeroAddress");

      // Set old router
      await factory.setRouter(oldRouter);
    });
  });
  describe("Transfer To", function () {
    it("Should revert if caller is not router", async function () {
      await expect(
        pair.transferTo(users[0].address, 100)
      ).to.be.revertedWithCustomError(pair, "CallerIsNotRouter");
    });
    it("Should revert if recipient address is zero", async function () {
      const oldRouter = await factory.router();
      // Set new router
      await factory.setRouter(owner.address);

      await expect(
        pair.transferTo(ethers.constants.AddressZero, 100)
      ).to.be.revertedWithCustomError(pair, "RecipientIsZeroAddress");

      // Set old router
      await factory.setRouter(oldRouter);
    });
  });
  describe("View functions", function () {
    let oldRouter: any;
    before(async function () {
      oldRouter = await factory.router();
      // Set new router
      await factory.setRouter(owner.address);

      // Mint to increase reserves
      await pair.mint(100, 100);
    });
    after(async function () {
      // Set old router
      await factory.setRouter(oldRouter);
    });
    it("Get PriceA Last", async function () {
      const priceA = await pair.priceALast();
      expect(priceA).to.be.equal(1);
    });
    it("Get PriceB Last", async function () {
      const priceB = await pair.priceBLast();
      expect(priceB).to.be.equal(1);
    });
    it("Should revert if has minted", async function () {
      await expect(pair.mint(100, 100)).to.be.revertedWithCustomError(
        pair,
        "AlreadyMinted"
      );
    });
  });
});
