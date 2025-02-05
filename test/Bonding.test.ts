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

describe("LaunchPad", function () {
  let owner: any;
  let treasury: any;
  let booster: any;
  let bonding: Bonding;
  let int: INT;
  let extRouter: IExtRouter;
  let oracle: MockOracle;
  let users: any[];
  let token: INTERC20;
  let lock: Lock;
  let lp: IERC20;
  let factory: INTFactory;
  let reader: TokenDataReader;

  before(async function () {
    ({
      bonding,
      reader,
      extRouter,
      oracle,
      factory,
      int,
      owner,
      treasury,
      booster,
      users,
    } = await setup());

    // Transfer INT tokens to test users
    const amount = ethers.utils.parseEther("100000");
    for (const user of users) {
      await treasury.int.transfer(user.address, amount);
      await user.int.approve(bonding.address, ethers.constants.MaxUint256);
    }
  });

  async function getLastTokenAndLocker(bonding: Bonding) {
    const count = await bonding.getTokenCount();

    const tokenAddress = await bonding.tokenInfos(count.sub(1));
    const token = (await ethers.getContractAt(
      "INTERC20",
      tokenAddress
    )) as INTERC20;

    const tokenInfo = await bonding.tokenInfo(token.address);
    const lockerAddress = tokenInfo.locker;
    const locker = (await ethers.getContractAt("Lock", lockerAddress)) as Lock;

    return {token, locker};
  }

  async function getExtLP(tokenA: string) {
    const {pair, hasPair} = await extRouter.pairFor([tokenA, int.address], 1);
    const LP = (await ethers.getContractAt("IERC20", pair)) as IERC20;

    return LP;
  }

  describe("Initialize", () => {
    it("SHould revert when trying to initialize again", async () => {
      const addressZero = ethers.constants.AddressZero;
      await expect(
        bonding.initialize(
          addressZero, // assetToken_,
          addressZero, // factory_,
          addressZero, // feeTo_,
          100, // fee_,
          100, // initialSupply_,
          addressZero, // extRouter_,
          addressZero, // tokenFactory_,
          addressZero, // lockFactory_,
          100, // lockedTime_,
          addressZero, // oracle_,
          100, // initialMarketCap_,
          100 // gradMarketCap_
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Administrative Configuration", () => {
    describe("Initial Supply", () => {
      it("Should set new initial supply", async () => {
        const oldInitialSupply = await bonding.initialSupply();
        const newInitialSupply = oldInitialSupply.add(
          ethers.utils.parseEther("1000")
        );

        await owner.bonding.setInitialSupply(newInitialSupply);
        expect(await bonding.initialSupply()).to.be.eq(newInitialSupply);

        // Reset to old value
        await owner.bonding.setInitialSupply(oldInitialSupply);
      });

      it("Should revert when general user sets new initial supply", async () => {
        const newInitialSupply = ethers.utils.parseEther("1000000");

        // Will revert when general user tries to set new initial supply
        await expect(
          users[0].bonding.setInitialSupply(newInitialSupply)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });

      it("Should launch with correct initial supply", async () => {
        const initialSupply = await bonding.initialSupply();

        await users[0].bonding.launch(
          "Supply Test Token",
          "SUPPLY",
          [1, 2, 3],
          "Test token description",
          "test-image.png",
          ["url1", "url2", "url3", "url4"],
          ethers.utils.parseEther("10.01") // Greater than fee
        );

        const {token} = await getLastTokenAndLocker(bonding);

        const totalSupply = await token.totalSupply();
        expect(totalSupply).to.equal(initialSupply);
      });
    });

    describe("Set Fee", () => {
      it("Should set new fee", async () => {
        const oldFee = await bonding.fee();
        const oldFeeTo = await bonding.feeTo();
        const newFee = oldFee.add(1);
        const newFeeTo = users[0].address;

        await owner.bonding.setFee(newFee, newFeeTo);
        expect(await bonding.fee()).to.be.eq(newFee);
        expect(await bonding.feeTo()).to.be.eq(newFeeTo);

        // Reset to old value
        await owner.bonding.setFee(oldFee, oldFeeTo);
      });

      it("Should revert when general user sets new fee", async () => {
        const newFee = BigNumber.from("10");

        // Will revert when general user tries to set new fee
        await expect(
          users[0].bonding.setFee(newFee, await bonding.feeTo())
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Oracle", () => {
      it("Should set an oracle", async () => {
        const oldOracle = await bonding.oracle();

        const OracleFactory = await ethers.getContractFactory("MockOracle");
        const newOracle = (await OracleFactory.deploy()) as MockOracle;
        await newOracle.deployed();
        // Set price in the oracle
        await newOracle.setAssetPrice(100);

        // Set new oracle
        await owner.bonding.setOracle(newOracle.address);
        expect(await bonding.oracle()).to.be.eq(newOracle.address);

        // Reset to old value
        await owner.bonding.setOracle(oldOracle);
      });
      it("Should revert when set an invalid oracle", async () => {
        const OracleFactory = await ethers.getContractFactory("MockOracle");
        const newOracle = (await OracleFactory.deploy()) as MockOracle;
        await newOracle.deployed();

        await expect(
          owner.bonding.setOracle(newOracle.address)
        ).to.be.revertedWithCustomError(bonding, "InvalidOracle");
      });
      it("Should revert when general user sets new oracle", async () => {
        const newOracle = users[0].address;

        // Will revert when general user tries to set new oracle
        await expect(users[0].bonding.setOracle(newOracle)).to.be.revertedWith(
          `Ownable: caller is not the owner`
        );
      });
    });

    describe("Set Initial Market Cap", () => {
      it("Should set new initial market cap", async () => {
        const oldInitialMarketCap = await bonding.initialMarketCap();
        const newInitialMarketCap = oldInitialMarketCap.add(1);

        await owner.bonding.setInitialMarketCap(newInitialMarketCap);
        expect(await bonding.initialMarketCap()).to.be.eq(newInitialMarketCap);

        // Reset to old value
        await owner.bonding.setInitialMarketCap(oldInitialMarketCap);
      });

      it("Should revert when set new initial market cap to zero", async () => {
        const newInitialMarketCap = BigNumber.from("0");

        // Will revert when tries to set new initial market cap to zero
        await expect(
          owner.bonding.setInitialMarketCap(newInitialMarketCap)
        ).to.be.revertedWithCustomError(bonding, "InvalidMarketCap");
      });

      it("Should revert when general user sets new initial market cap", async () => {
        const newInitialMarketCap = BigNumber.from("1000000");

        // Will revert when general user tries to set new initial market cap
        await expect(
          users[0].bonding.setInitialMarketCap(newInitialMarketCap)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Graduation Market Cap", () => {
      it("Should set new graduation market cap", async () => {
        const oldGradMarketCap = await bonding.gradMarketCap();
        const newGradMarketCap = oldGradMarketCap.add(1);

        await owner.bonding.setGradMarketCap(newGradMarketCap);
        expect(await bonding.gradMarketCap()).to.be.eq(newGradMarketCap);

        // Reset to old value
        await owner.bonding.setGradMarketCap(oldGradMarketCap);
      });

      it("Should revert when set new graduation market less than initial market cap", async () => {
        const initialMarketCap = await bonding.initialMarketCap();
        const newGradMarketCap = initialMarketCap.sub(1);

        await expect(
          owner.bonding.setGradMarketCap(newGradMarketCap)
        ).to.be.revertedWithCustomError(bonding, "InvalidMarketCap");
      });

      it("Should revert when general user sets new graduation market cap", async () => {
        const newGradMarketCap = BigNumber.from("1000000");

        // Will revert when general user tries to set new graduation market cap
        await expect(
          users[0].bonding.setGradMarketCap(newGradMarketCap)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Locked Time", () => {
      it("Should set new locked time", async () => {
        const oldLockedTime = await bonding.lockedTime();
        console.log(oldLockedTime);
        const newLockedTime = oldLockedTime.add(2);
        console.log(newLockedTime);

        await owner.bonding.setLockedTime(newLockedTime);
        expect(await bonding.lockedTime()).to.be.eq(newLockedTime);

        // Reset to old value
        await owner.bonding.setLockedTime(oldLockedTime.add("1"));
      });

      it("Should revert when set new locked time less than 1 year", async () => {
        const newLockedTime = BigNumber.from("31536000").sub(1);

        // Will revert when tries to set new locked time less than 1 year
        await expect(
          owner.bonding.setLockedTime(newLockedTime)
        ).to.be.revertedWithCustomError(bonding, "InvalidLockTime");
      });

      it("Should revert when general user sets new locked time", async () => {
        const newLockedTime = BigNumber.from("1000000");

        // Will revert when general user tries to set new locked time
        await expect(
          users[0].bonding.setLockedTime(newLockedTime)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Factory", () => {
      it("Should set new factory", async () => {
        const oldFactory = await bonding.factory();
        const newFactory = users[0].address;

        await owner.bonding.setFactory(newFactory);
        expect(await bonding.factory()).to.be.eq(newFactory);

        // Reset to old value
        await owner.bonding.setFactory(oldFactory);
      });

      it("Should revert when general user sets new factory", async () => {
        const newFactory = users[0].address;

        // Will revert when general user tries to set new factory
        await expect(
          users[0].bonding.setFactory(newFactory)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Token Factory", () => {
      it("Should set new token factory", async () => {
        const oldTokenFactory = await bonding.tokenFactory();
        const newTokenFactory = users[0].address;

        await owner.bonding.setTokenFactory(newTokenFactory);
        expect(await bonding.tokenFactory()).to.be.eq(newTokenFactory);

        // Reset to old value
        await owner.bonding.setTokenFactory(oldTokenFactory);
      });

      it("Should revert when general user sets new token factory", async () => {
        const newTokenFactory = users[0].address;

        // Will revert when general user tries to set new token factory
        await expect(
          users[0].bonding.setTokenFactory(newTokenFactory)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Lock Factory", () => {
      it("Should set new lock factory", async () => {
        const oldLockFactory = await bonding.lockFactory();
        const newLockFactory = users[0].address;

        await owner.bonding.setLockFactory(newLockFactory);
        expect(await bonding.lockFactory()).to.be.eq(newLockFactory);

        // Reset to old value
        await owner.bonding.setLockFactory(oldLockFactory);
      });

      it("Should revert when general user sets new lock factory", async () => {
        const newLockFactory = users[0].address;

        // Will revert when general user tries to set new lock factory
        await expect(
          users[0].bonding.setLockFactory(newLockFactory)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set External Router", () => {
      it("Should set new external router", async () => {
        const oldExtRouter = await bonding.extRouter();
        const newExtRouter = users[0].address;

        await owner.bonding.setExtRouter(newExtRouter);
        expect(await bonding.extRouter()).to.be.eq(newExtRouter);

        // Reset to old value
        await owner.bonding.setExtRouter(oldExtRouter);
      });

      it("Should revert when general user sets new external router", async () => {
        const newExtRouter = users[0].address;

        // Will revert when general user tries to set new external router
        await expect(
          users[0].bonding.setExtRouter(newExtRouter)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Asset Token", () => {
      it("Should set new asset token", async () => {
        const oldAssetToken = await bonding.assetToken();
        const newAssetToken = users[0].address;

        await owner.bonding.setAssetToken(newAssetToken);
        expect(await bonding.assetToken()).to.be.eq(newAssetToken);

        // Reset to old value
        await owner.bonding.setAssetToken(oldAssetToken);
      });

      it("Should revert when general user sets new asset token", async () => {
        const newAssetToken = users[0].address;

        // Will revert when general user tries to set new asset token
        await expect(
          users[0].bonding.setAssetToken(newAssetToken)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });
    });

    describe("Set Boost Stage Threshold", () => {
      it("Should set new boost stage threshold", async () => {
        const oldBoostStageThresholdValue = await bonding.boostStageThresholds(
          1
        );
        const newBoostStageThreshold = 1;
        const newBoostStageThresholdValue = oldBoostStageThresholdValue.add(1);

        await owner.bonding.setBoostStageThreshold(
          newBoostStageThreshold,
          newBoostStageThresholdValue
        );
        expect(
          await bonding.boostStageThresholds(newBoostStageThreshold)
        ).to.be.eq(newBoostStageThresholdValue);
      });

      it("Should revert when general user sets new boost stage threshold", async () => {
        const oldBoostStageThresholdValue = await bonding.boostStageThresholds(
          1
        );
        const newBoostStageThreshold = 1;
        const newBoostStageThresholdValue = oldBoostStageThresholdValue.add(1);

        // Will revert when general user tries to set new boost stage threshold
        await expect(
          users[0].bonding.setBoostStageThreshold(
            newBoostStageThreshold,
            newBoostStageThresholdValue
          )
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });

      it("Should revert when boost stage is invalid", async () => {
        // Will revert when boost stage is 0
        await expect(
          owner.bonding.setBoostStageThreshold(0, 1)
        ).to.be.revertedWithCustomError(bonding, "InvalidStage");

        // Will revert when boost stage is greater than 3
        await expect(
          owner.bonding.setBoostStageThreshold(4, 1)
        ).to.be.revertedWithCustomError(bonding, "InvalidStage");
      });

      it("Should revert when new stage threshold is invalid", async () => {
        for (let i = 0; i < 3; i++) {
          let newStage = i + 1;
          // Will revert when new stage threshold is 0
          await expect(
            owner.bonding.setBoostStageThreshold(newStage, 0)
          ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");

          // Will revert when new stage threshold is equal to previous stage threshold
          let oldBoostStageThresholdValue = await bonding.boostStageThresholds(
            newStage - 1
          );
          await expect(
            owner.bonding.setBoostStageThreshold(
              newStage,
              oldBoostStageThresholdValue
            )
          ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");
          // Will revert when new stage threshold is less than previous stage threshold
          await expect(
            owner.bonding.setBoostStageThreshold(
              newStage,
              oldBoostStageThresholdValue.eq(0)
                ? oldBoostStageThresholdValue
                : oldBoostStageThresholdValue.sub(1)
            )
          ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");
        }
      });

      it("Should revert when general user sets boost stage thresholds", async () => {
        // Will revert when general user tries to set boost stage thresholds
        await expect(
          users[0].bonding.setBoostStageThresholds([1])
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });

      it("Should revert when sets boost stage thresholds with invalid length", async () => {
        // Will revert when boost stage thresholds length is invalid
        await expect(
          owner.bonding.setBoostStageThresholds([1, 2, 3, 4])
        ).to.be.revertedWithCustomError(bonding, "InputArrayMismatch");
        await expect(
          owner.bonding.setBoostStageThresholds([1, 2])
        ).to.be.revertedWithCustomError(bonding, "InputArrayMismatch");
      });

      it("Should revert when sets boost stage thresholds with invalid threshold", async () => {
        const stage1ThresholdValue = await bonding.boostStageThresholds(0);

        // Will revert when new stage1 threshold is equal to 0
        await expect(
          owner.bonding.setBoostStageThresholds([0, 1, 2])
        ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");

        // Will revert when new stage2 threshold is equal to new stage1 threshold
        await expect(
          owner.bonding.setBoostStageThresholds([
            stage1ThresholdValue.add("1"),
            stage1ThresholdValue.add("1"),
            stage1ThresholdValue.add("2"),
          ])
        ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");

        // Will revert when new stage2 threshold is less than new stage1 threshold
        await expect(
          owner.bonding.setBoostStageThresholds([
            stage1ThresholdValue.add("1"),
            stage1ThresholdValue.add("0"),
            stage1ThresholdValue.add("2"),
          ])
        ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");

        // Will revert when new stage3 threshold is equal to new stage2 threshold
        await expect(
          owner.bonding.setBoostStageThresholds([
            stage1ThresholdValue.add("1"),
            stage1ThresholdValue.add("2"),
            stage1ThresholdValue.add("2"),
          ])
        ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");

        // Will revert when new stage3 threshold is less than new stage2 threshold
        await expect(
          owner.bonding.setBoostStageThresholds([
            stage1ThresholdValue.add("1"),
            stage1ThresholdValue.add("2"),
            stage1ThresholdValue.add("1"),
          ])
        ).to.be.revertedWithCustomError(bonding, "InvalidThreshold");
      });
    });
  });

  describe("General Workflow", () => {
    describe("Bonding", () => {
      it("Should launch", async () => {
        await expect(
          users[0].bonding.launch(
            "Just a chill guy",
            "CHILLGUY",
            [1, 2, 3], // cores array
            "Test token description",
            "test-image.png",
            ["url1", "url2", "url3", "url4"], // urls array
            ethers.utils.parseEther("10.01") // purchaseAmount greater than fee
          )
        ).to.emit(bonding, "Launched");

        const tokenAddress = await bonding.tokenInfos(0);
        token = (await ethers.getContractAt(
          "INTERC20",
          tokenAddress
        )) as INTERC20;

        // Get token
        expect(await token.balanceOf(users[0].address)).to.be.gt(0);

        const tokenInfo = await bonding.tokenInfo(token.address);
        const lockerAddress = tokenInfo.locker;
        lock = (await ethers.getContractAt("Lock", lockerAddress)) as Lock;
      });

      it("Should buy", async () => {
        let amount = ethers.utils.parseEther("1");
        const tokenLockerAddr = await bonding.getTokenLocker(token.address);

        const beforeTokenLockerBalance = await int.balanceOf(tokenLockerAddr);
        const beforeTreasuryBalance = await int.balanceOf(treasury.address);
        const beforeTradingFeeAtBonding = await lock.tradingFeeAtBonding();
        const beforeTokenBalance = await token.balanceOf(users[0].address);

        let buyingFeeRatio = await factory.buyFee();
        let treasuryFeeRatio = await factory.treasuryFeeRatio();
        let feeAmount = amount.mul(buyingFeeRatio).div(100);
        let treasuryFee = feeAmount.mul(treasuryFeeRatio).div(100);
        let lockFee = feeAmount.sub(treasuryFee);

        let result = await bonding.quoteBuy(token.address, amount);

        expect(feeAmount).to.be.eq(result[1]);

        await expect(
          users[0].bonding.buy(amount, token.address)
        ).to.changeTokenBalance(int, users[0].address, amount.mul(-1));

        const afterTokenLockerBalance = await int.balanceOf(tokenLockerAddr);
        const afterTreasuryBalance = await int.balanceOf(treasury.address);
        const afterTradingFeeAtBonding = await lock.tradingFeeAtBonding();
        const afterTokenBalance = await token.balanceOf(users[0].address);

        expect(afterTokenLockerBalance).to.be.eq(
          beforeTokenLockerBalance.add(lockFee)
        );
        expect(afterTreasuryBalance).to.be.eq(
          beforeTreasuryBalance.add(treasuryFee)
        );
        expect(afterTradingFeeAtBonding).to.be.eq(
          beforeTradingFeeAtBonding.add(lockFee)
        );
        expect(afterTokenBalance).to.be.eq(beforeTokenBalance.add(result[0]));
      });

      it("Should revert when buying none token", async () => {
        const amount = ethers.utils.parseEther("1");
        const randomAddress = ethers.Wallet.createRandom().address;

        await expect(
          users[0].bonding.buy(amount, randomAddress)
        ).to.be.revertedWithCustomError(bonding, "NotTrading");
      });

      it("Should sell", async () => {
        const signer = await ethers.getSigner(users[0].address);

        await token
          .connect(signer)
          .approve(bonding.address, ethers.constants.MaxUint256);

        const balance = await token.balanceOf(users[0].address);

        // console.log(balance);

        const tokenLocker = await bonding.getTokenLocker(token.address);

        let result = await bonding.quoteSell(token.address, balance);

        const beforeTokenLockerBalance = await int.balanceOf(tokenLocker);
        const beforeTreasuryBalance = await int.balanceOf(treasury.address);
        const beforeTradingFeeAtBonding = await lock.tradingFeeAtBonding();
        const beforeAssetBalance = await int.balanceOf(users[0].address);

        let sellingFeeRatio = await factory.sellFee();
        let treasuryFeeRatio = await factory.treasuryFeeRatio();
        let feeAmount = result[0].add(result[1]).mul(sellingFeeRatio).div(100);
        expect(feeAmount).to.be.eq(result[1]);
        let treasuryFee = feeAmount.mul(treasuryFeeRatio).div(100);
        let lockFee = feeAmount.sub(treasuryFee);

        await expect(
          users[0].bonding.sell(balance, token.address)
        ).to.changeTokenBalance(token, users[0].address, balance.mul(-1));

        const afterTokenLockerBalance = await int.balanceOf(tokenLocker);
        const afterTreasuryBalance = await int.balanceOf(treasury.address);
        const afterTradingFeeAtBonding = await lock.tradingFeeAtBonding();
        const afterAssetBalance = await int.balanceOf(users[0].address);

        expect(afterTokenLockerBalance).to.be.eq(
          beforeTokenLockerBalance.add(lockFee)
        );
        expect(afterTreasuryBalance).to.be.eq(
          beforeTreasuryBalance.add(treasuryFee)
        );
        expect(afterTradingFeeAtBonding).to.be.eq(
          beforeTradingFeeAtBonding.add(lockFee)
        );
        expect(afterAssetBalance).to.be.eq(beforeAssetBalance.add(result[0]));
      });

      it("Should revert when selling none token", async () => {
        const amount = ethers.utils.parseEther("1");
        const randomAddress = ethers.Wallet.createRandom().address;

        await expect(
          users[0].bonding.sell(amount, randomAddress)
        ).to.be.revertedWithCustomError(bonding, "NotTrading");
      });

      it("Should revert when transferring token during bonding", async () => {
        const amount = ethers.utils.parseEther("1");
        // Buy some tokens
        await users[0].bonding.buy(amount, token.address);
        // User have some tokens
        expect(await token.balanceOf(users[0].address)).to.be.gt(0);

        // During bonding, can not transfer tokens between accounts
        await expect(
          token
            .connect(await ethers.getSigner(users[0].address))
            .transfer(users[1].address, amount)
        ).to.be.revertedWithCustomError(token, "TransferDisabled");
      });

      describe("claimForTokenCreator", () => {
        it("Should revert when trying to claim before graduated", async () => {
          // Token should not be graduated
          expect(await bonding.hasGraduated(token.address)).to.be.false;

          // User can not claim fee before graduated
          await expect(
            lock
              .connect(await ethers.getSigner(users[0].address))
              .claimForTokenCreator()
          ).to.be.revertedWithCustomError(lock, "TokenDoesNotGraduate");
        });
      });

      it("Should have correct pair address in internal router", async () => {
        const tokenInfo = await bonding.tokenInfo(token.address);
        const expectedPair = await factory.getPair(int.address, token.address);

        expect(tokenInfo.pair).to.equal(expectedPair);
      });
    });

    describe("Graduation", () => {
      it("Should graduated", async () => {
        // Buy some tokens to graduate
        const amount = ethers.utils.parseEther("11322").mul(101).div(100);
        await expect(users[0].bonding.buy(amount, token.address)).to.emit(
          bonding,
          "Graduated"
        );
      });

      it("Should transfer tokens freely", async () => {
        const amount = ethers.utils.parseEther("1");

        // Token transfer is enabled after graduated
        expect(await token.transferDisabled()).to.be.false;
        // Can transfer tokens to another user
        await expect(
          token
            .connect(await ethers.getSigner(users[0].address))
            .transfer(users[1].address, amount)
        ).to.changeTokenBalances(
          token,
          [users[0].address, users[1].address],
          [amount.mul(-1), amount]
        );

        const lockedInfo = await lock.lockedInfos(await lock.lp());
        // console.log(lockedInfo);

        const [lpAddress] = await extRouter.pairFor(
          [int.address, token.address],
          1
        );
        lp = (await ethers.getContractAt("IERC20", lpAddress)) as IERC20;
        const lpBal = await lp.balanceOf(lock.address);

        // console.log(lpBal);
      });

      it("Should revert when try to buy", async () => {
        const amount = ethers.utils.parseEther("1");

        await expect(
          users[0].bonding.buy(amount, token.address)
        ).to.be.revertedWithCustomError(bonding, "NotTrading");
      });

      it("Should revert when try to sell", async () => {
        const amount = ethers.utils.parseEther("1");

        await expect(
          users[0].bonding.sell(amount, token.address)
        ).to.be.revertedWithCustomError(bonding, "NotTrading");
      });

      it("Should have correct pair address in external router", async () => {
        const tokenInfo = await bonding.tokenInfo(token.address);
        const expectedPair = (
          await extRouter.pairFor([int.address, token.address], 1)
        ).pair;

        expect(tokenInfo.pair).to.equal(expectedPair);
      });

      describe("lockLP", () => {
        it("Should revert when user tries to lock tokens", async () => {
          const amount = ethers.utils.parseEther("1");

          // User can not lock tokens
          await expect(
            lock
              .connect(await ethers.getSigner(users[0].address))
              .lockLP(amount)
          ).to.be.revertedWithCustomError(lock, "NotBonding");
        });

        it("Should revert when user tries to set lp", async () => {
          // User can not set lp
          await expect(
            lock
              .connect(await ethers.getSigner(users[0].address))
              .setLP(users[0].address)
          ).to.be.revertedWithCustomError(lock, "NotBonding");
        });
      });

      describe("claimForTokenCreator", () => {
        it("Should claim fee for token creator", async () => {
          // Token should be graduated
          expect(await bonding.hasGraduated(token.address)).to.be.true;

          const tokenCreator = await bonding.getTokenCreator(token.address);
          const tradingFeeAtBonding = await lock.tradingFeeAtBonding();

          await expect(
            lock
              .connect(await ethers.getSigner(users[0].address))
              .claimForTokenCreator()
          ).to.changeTokenBalance(int, tokenCreator, tradingFeeAtBonding);
        });
      });

      describe("delegate LP", () => {
        it("Should revert when delegate lp before lp released", async () => {
          const lockedInfo = await lock.lockedInfos(await lock.lp());
          // Has not reached the release time
          expect(lockedInfo.releasedTime).to.be.gt(await time.latest());

          // Locked lp should not be delegated before released
          await expect(
            bonding.delegateLPTo(token.address, users[0].address)
          ).to.be.revertedWithCustomError(lock, "NotReleased");
        });

        it("Should delegate lp when when lp released", async () => {
          const lockedInfo = await lock.lockedInfos(await lock.lp());

          // Reach the release time
          await time.setNextBlockTimestamp(lockedInfo.releasedTime.toNumber());

          const beforeUseLPAllowance = await lp.allowance(
            lock.address,
            users[0].address
          );

          // Locked lp should be delegated after released
          expect(
            await bonding.delegateLPTo(token.address, users[0].address)
          ).to.emit(bonding, "DelegateLPTo");

          const afterUseLPAllowance = await lp.allowance(
            lock.address,
            users[0].address
          );

          expect(afterUseLPAllowance).to.gt("0");
          expect(afterUseLPAllowance).to.be.eq(
            beforeUseLPAllowance.add(lockedInfo.lockedAmount)
          );
        });

        it("Should revert when user tries to delegate lp", async () => {
          // User can not delegate lp
          await expect(
            users[0].bonding.delegateLPTo(token.address, users[1].address)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should revert when user tries to delegate lp to zero address", async () => {
          // User can not delegate lp to zero address
          await expect(
            owner.bonding.delegateLPTo(
              token.address,
              ethers.constants.AddressZero
            )
          ).to.be.revertedWithCustomError(bonding, "InvalidDelegatee");
        });

        it("Should delegate lp by batch", async () => {
          const delegatee = [users[5].address];

          const beforeUseLPAllowance = await lp.allowance(
            lock.address,
            delegatee[0]
          );

          // Locked lp should be delegated after released
          await expect(
            bonding.delegateLPToBatch([token.address], delegatee)
          ).to.emit(bonding, "DelegateLPTo");

          const lockedInfo = await lock.lockedInfos(await lock.lp());

          const afterUseLPAllowance = await lp.allowance(
            lock.address,
            delegatee[0]
          );

          expect(afterUseLPAllowance).to.gt("0");
          expect(afterUseLPAllowance).to.be.eq(lockedInfo.lockedAmount);
        });

        it("Should revert when general user tries to delegate lp by batch", async () => {
          const delegatee = [users[5].address];

          // User can not delegate lp by batch
          await expect(
            users[0].bonding.delegateLPToBatch([token.address], delegatee)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should revert when delegate lp by batch with different length", async () => {
          const delegatee = [users[5].address, users[6].address];

          // Will revert when delegatee length is different from token length
          await expect(
            bonding.delegateLPToBatch([token.address], delegatee)
          ).to.be.revertedWithCustomError(bonding, "InputArrayMismatch");
        });
      });
    });
  });

  describe("launch", () => {
    it("Should launch without initial purchase", async () => {
      const fee = await bonding.fee();

      await expect(
        users[0].bonding.launch(
          "Just a chill guy",
          "CHILLGUY",
          [1, 2, 3], // cores array
          "Test token description",
          "test-image.png",
          ["url1", "url2", "url3", "url4"], // urls array
          fee
        )
      ).to.emit(bonding, "Launched");
    });

    it("Should launch with fee is zero", async () => {
      const originalFee = await bonding.fee();
      const amount = originalFee.gt(0) ? originalFee.sub(1) : originalFee;
      // Set fee to zero
      await owner.bonding.setFee(0, await bonding.feeTo());
      expect(await bonding.fee()).to.be.eq(0);

      await expect(
        users[0].bonding.launch(
          "Just a chill guy",
          "CHILLGUY",
          [1, 2, 3], // cores array
          "Test token description",
          "test-image.png",
          ["url1", "url2", "url3", "url4"], // urls array
          amount
        )
      ).to.emit(bonding, "Launched");

      // Reset fee
      await owner.bonding.setFee(originalFee, await bonding.feeTo());
    });

    it("Should successfully launch for another user", async () => {
      const purchaseAmount = ethers.utils.parseEther("10");
      const beforeTokenCount = await bonding.getTokenCount();

      await users[0].bonding.launchFor(
        users[1].address,
        "Test Token",
        "TEST",
        [1, 2, 3],
        "Test Description",
        "test.png",
        ["twitter.com", "t.me", "farcaster.com", "test.com"],
        purchaseAmount
      );

      const afterTokenCount = await bonding.getTokenCount();
      expect(afterTokenCount).to.be.eq(beforeTokenCount.add(1));

      const {token, locker: lock} = await getLastTokenAndLocker(bonding);
      const tokenInfo = await bonding.tokenInfo(token.address);

      // Verify token creator is set correctly
      expect(tokenInfo.creator).to.be.eq(users[1].address);

      // Verify token appears in creator's profile
      // const userTokens = await bonding.getUserTokens(users[1].address);
      // expect(userTokens).to.include(token.address);
    });

    it("Should revert when user does not have enough token to buy", async () => {
      const user0TokenBalance = await users[0].int.balanceOf(users[0].address);
      await expect(
        users[0].bonding.launch(
          "Test Token",
          "TEST",
          [1, 2, 3],
          "Test Description",
          "test.png",
          ["twitter.com", "t.me", "farcaster.com", "test.com"],
          user0TokenBalance.add(1)
        )
      ).to.be.revertedWithCustomError(bonding, "InsufficientAmount");
    });
  });

  describe("boost", () => {
    let user: any;
    let token: INTERC20;
    let locker: Lock;
    let lp: IERC20;

    describe("Access Control", () => {
      it("Should revert when non-booster calls boost1", async () => {
        const timestamp = await time.latest();
        await expect(
          users[0].bonding.boost1(
            "Test Token",
            "TEST",
            [1, 2, 3],
            "Test Description",
            "test.png",
            ["twitter.com", "t.me", "farcaster.com", "test.com"],
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            0,
            timestamp + 600
          )
        ).to.be.revertedWith(
          `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
            "BOOSTER_ROLE"
          )}`
        );
      });

      it("Should revert when non-booster calls boost1For", async () => {
        const timestamp = await time.latest();
        await expect(
          users[0].bonding.boost1For(
            users[5].address,
            "Test Token",
            "TEST",
            [1, 2, 3],
            "Test Description",
            "test.png",
            ["twitter.com", "t.me", "farcaster.com", "test.com"],
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            0,
            timestamp + 600
          )
        ).to.be.revertedWith(
          `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
            "BOOSTER_ROLE"
          )}`
        );
      });

      it("Should revert when non-booster calls boost2", async () => {
        const timestamp = await time.latest();
        await expect(
          users[0].bonding.boost2(
            users[0].address,
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            0,
            timestamp + 600
          )
        ).to.be.revertedWith(
          `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
            "BOOSTER_ROLE"
          )}`
        );
      });

      it("Should revert when non-booster calls boost3", async () => {
        const timestamp = await time.latest();
        await expect(
          users[0].bonding.boost3(
            users[0].address,
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            ethers.utils.parseEther("1000"),
            0,
            timestamp + 600
          )
        ).to.be.revertedWith(
          `AccessControl: account ${users[0].address.toLowerCase()} is missing role ${ethers.utils.id(
            "BOOSTER_ROLE"
          )}`
        );
      });
    });

    describe("Stage 1", () => {
      it("Should successfully boost liquidity", async () => {
        const tokenAmount = ethers.utils.parseEther("800000000");
        const assetAmount = ethers.utils.parseEther("30000");

        await treasury.int.approve(bonding.address, assetAmount);

        const boostCountB = await bonding.getBoostCount();

        const timestamp = await time.latest();

        await booster.bonding.boost1(
          "Test Token",
          "TEST",
          [1, 2, 3],
          "Test Description",
          "test.png",
          ["twitter.com", "t.me", "farcaster.com", "test.com"],
          tokenAmount,
          assetAmount,
          tokenAmount,
          assetAmount,
          0,
          timestamp + 600
        );

        ({token, locker} = await getLastTokenAndLocker(bonding));
        lp = await getExtLP(token.address);

        const isBoost = await bonding.isBoostToken(token.address);
        expect(isBoost).to.eq(true);

        const boostCountA = await bonding.getBoostCount();
        expect(boostCountA).to.eq(boostCountB.add(1));

        // Stage should be 1
        const boostInfo = await bonding.getBoostInfo(token.address);
        expect(boostInfo.stage).to.eq(1);

        // LP and boostToken should go to lock
        const afterLockLPBalance = await lp.balanceOf(locker.address);
        expect(afterLockLPBalance).to.be.gt(0);

        const afterTokenBalance = await token.balanceOf(locker.address);
        expect(afterTokenBalance).to.be.gt(0);
      });

      it("Should successfully boost liquidity for another user", async () => {
        const creator = users[5].address;
        const tokenAmount = ethers.utils.parseEther("800000000");
        const assetAmount = ethers.utils.parseEther("30000");

        await treasury.int.approve(bonding.address, assetAmount);

        const boostCountB = await bonding.getBoostCount();
        const timestamp = await time.latest();

        await booster.bonding.boost1For(
          creator,
          "Test Token",
          "TEST",
          [1, 2, 3],
          "Test Description",
          "test.png",
          ["twitter.com", "t.me", "farcaster.com", "test.com"],
          tokenAmount,
          assetAmount,
          tokenAmount,
          assetAmount,
          0,
          timestamp + 600
        );

        ({token, locker} = await getLastTokenAndLocker(bonding));
        lp = await getExtLP(token.address);

        const isBoost = await bonding.isBoostToken(token.address);
        expect(isBoost).to.eq(true);

        const boostCountA = await bonding.getBoostCount();
        expect(boostCountA).to.eq(boostCountB.add(1));

        // New token creator should be the creator
        const tokenInfo = await bonding.tokenInfo(token.address);
        expect(tokenInfo.creator).to.eq(creator);
        expect(tokenInfo.creator).to.not.eq(booster.address);

        // Stage should be 1
        const boostInfo = await bonding.getBoostInfo(token.address);
        expect(boostInfo.stage).to.eq(1);

        // LP and boostToken should go to lock
        const afterLockLPBalance = await lp.balanceOf(locker.address);
        expect(afterLockLPBalance).to.be.gt(0);

        const afterTokenBalance = await token.balanceOf(locker.address);
        expect(afterTokenBalance).to.be.gt(0);
      });

      it("Should fail if initial liquidity too low", async () => {
        const boostStage1Thresholds = await bonding.boostStageThresholds(1);
        const assetPrice = await oracle.callStatic.getAssetPrice();

        const tokenAmount = ethers.utils.parseEther("800000000");
        const assetAmount = boostStage1Thresholds
          .mul(utils.parseEther("1"))
          .div(assetPrice)
          .div(2)
          .sub(1);

        await treasury.int.approve(bonding.address, assetAmount);

        const timestamp = await time.latest();

        await expect(
          booster.bonding.boost1(
            "Test Token",
            "TEST",
            [1, 2, 3],
            "Test Description",
            "test.png",
            ["twitter.com", "t.me", "farcaster.com", "test.com"],
            tokenAmount,
            assetAmount,
            tokenAmount,
            assetAmount,
            0,
            timestamp + 600
          )
        ).to.revertedWithCustomError(bonding, "LiquidityTooLow");
      });

      it("Should have correct pair address in external router", async () => {
        const tokenInfo = await bonding.tokenInfo(token.address);
        const expectedPair = (
          await extRouter.pairFor([int.address, token.address], 1)
        ).pair;

        expect(tokenInfo.pair).to.equal(expectedPair);
      });

      it("Should revert when try to buy", async () => {
        const amount = ethers.utils.parseEther("1");

        await expect(
          users[0].bonding.sell(amount, token.address)
        ).to.be.revertedWithCustomError(bonding, "NotTrading");
      });

      it("Should revert when try to sell", async () => {
        const amount = ethers.utils.parseEther("1");

        await expect(
          users[0].bonding.sell(amount, token.address)
        ).to.be.revertedWithCustomError(bonding, "NotTrading");
      });
    });

    describe("Stage 2", () => {
      it("Should not boost wrong stage", async () => {
        const tokenAmount = ethers.utils.parseEther("100000000");
        const assetAmount = ethers.utils.parseEther("6000");

        const timestamp = await time.latest();

        await expect(
          booster.bonding.boost3(
            token.address,
            tokenAmount,
            assetAmount,
            tokenAmount,
            assetAmount,
            0,
            timestamp + 600
          )
        ).to.revertedWithCustomError(bonding, "WrongBoostStage");
      });

      it("Should fail if the market cap does not reach threshold ", async () => {
        const tokenAmount = ethers.utils.parseEther("100000000");
        const assetAmount = ethers.utils.parseEther("6000");

        const timestamp = await time.latest();

        await expect(
          booster.bonding.boost2(
            token.address,
            tokenAmount,
            assetAmount,
            tokenAmount,
            assetAmount,
            0,
            timestamp + 600
          )
        ).to.revertedWithCustomError(bonding, "MarketCapTooLow");
      });

      it("Should successfully boost liquidity", async () => {
        const tokenAmount = ethers.utils.parseEther("100000000");
        const assetAmount = ethers.utils.parseEther("6000");

        await treasury.int.approve(bonding.address, assetAmount);

        const price = await oracle.callStatic.getAssetPrice();
        const marketCap = await bonding.callStatic.calculateMarketCap(
          token.address
        );
        const threshold = await bonding.boostStageThresholds(2);
        const targetPrice = threshold
          .mul(utils.parseEther("1.00001"))
          .div(marketCap);

        // console.log(targetPrice);

        // Change the price to meet the threshold
        await owner.oracle.setAssetPrice(targetPrice);

        const beforeLockLPBalance = await lp.balanceOf(locker.address);
        const beforeTokenBalance = await token.balanceOf(locker.address);

        const timestamp = await time.latest();

        await booster.bonding.boost2(
          token.address,
          tokenAmount,
          assetAmount,
          tokenAmount,
          assetAmount,
          0,
          timestamp + 600
        );

        // Stage should be 2
        const boostInfo = await bonding.getBoostInfo(token.address);
        expect(boostInfo.stage).to.eq(2);

        // LP and Token should go to lock
        const afterLockLPBalanceA = await lp.balanceOf(locker.address);
        expect(afterLockLPBalanceA).to.be.gt(beforeLockLPBalance);

        const afterTokenBalance = await token.balanceOf(locker.address);
        expect(afterTokenBalance).to.be.eq(beforeTokenBalance.sub(tokenAmount));

        // restore the price
        await owner.oracle.setAssetPrice(price);
      });
    });

    describe("Stage 3", () => {
      it("Should not boost wrong stage", async () => {
        const tokenAmount = ethers.utils.parseEther("100000000");
        const assetAmount = ethers.utils.parseEther("6000");
        const timestamp = await time.latest();

        await expect(
          booster.bonding.boost2(
            token.address,
            tokenAmount,
            assetAmount,
            tokenAmount,
            assetAmount,
            0,
            timestamp + 600
          )
        ).to.revertedWithCustomError(bonding, "WrongBoostStage");
      });

      it("Should fail if the market cap does not reach threshold ", async () => {
        const tokenAmount = ethers.utils.parseEther("100000000");
        const assetAmount = ethers.utils.parseEther("6000");

        const timestamp = await time.latest();

        await expect(
          booster.bonding.boost3(
            token.address,
            tokenAmount,
            assetAmount,
            tokenAmount,
            assetAmount,
            0,
            timestamp + 600
          )
        ).to.revertedWithCustomError(bonding, "MarketCapTooLow");
      });

      it("Should successfully boost liquidity", async () => {
        const tokenAmount = ethers.utils.parseEther("100000000");
        const assetAmount = ethers.utils.parseEther("3000");

        await treasury.int.approve(bonding.address, assetAmount);

        const price = await oracle.callStatic.getAssetPrice();
        const marketCap = await bonding.callStatic.calculateMarketCap(
          token.address
        );
        const threshold = await bonding.boostStageThresholds(3);
        const targetPrice = threshold
          .mul(utils.parseEther("1.00001"))
          .div(marketCap);

        // console.log(targetPrice);

        // Change the price to meet the threshold
        await owner.oracle.setAssetPrice(targetPrice);

        const beforeLockLPBalance = await lp.balanceOf(locker.address);
        const beforeTokenBalance = await token.balanceOf(locker.address);

        const timestamp = await time.latest();

        await booster.bonding.boost3(
          token.address,
          tokenAmount,
          assetAmount,
          tokenAmount,
          assetAmount,
          0,
          timestamp + 600
        );

        // Stage should be 3
        const boostInfo = await bonding.getBoostInfo(token.address);
        expect(boostInfo.stage).to.eq(3);

        // LP and Token should go to lock
        const afterLockLPBalance = await lp.balanceOf(locker.address);
        expect(afterLockLPBalance).to.be.gt(beforeLockLPBalance);

        const afterTokenBalance = await token.balanceOf(locker.address);
        expect(afterTokenBalance).to.be.eq(beforeTokenBalance.sub(tokenAmount));

        // restore the price
        await owner.oracle.setAssetPrice(price);
      });
    });
  });

  describe("MarketCap", () => {
    it("Should get asset price from oracle", async () => {
      const price = await oracle.callStatic.getAssetPrice();

      // console.log(price);

      expect(price).to.gt(0);
    });

    it("Should get market cap of non-graduate token", async () => {
      const initialMarketCap = await bonding.initialMarketCap();

      // launch token with no initial purchase
      await users[0].bonding.launch(
        "Just a chill guy",
        "CHILLGUY",
        [1, 2, 3], // cores array
        "Test token description",
        "test-image.png",
        ["url1", "url2", "url3", "url4"], // urls array
        ethers.utils.parseEther("10")
      );

      const {token: newToken} = await getLastTokenAndLocker(bonding);

      // Get market cap from bonding contract
      const marketCap = await bonding.callStatic.calculateMarketCap(
        newToken.address
      );

      // console.log(marketCap);

      // There is a rounding error
      expect(marketCap).to.be.closeTo(initialMarketCap, 1);
    });

    it("Should get market cap of graduate token", async () => {
      const gradMarketCap = await bonding.gradMarketCap();

      // Get market cap from bonding contract
      const marketCap = await bonding.callStatic.calculateMarketCap(
        token.address
      );

      // console.log(marketCap);

      // TODO: find a reasonable value
      // After graduation, the virtual liquidity of initial market cap was gone
      expect(marketCap).to.gt(gradMarketCap.div(2));
    });

    it("Should revert when calculate market cap of an invalid token", async () => {
      await expect(
        bonding.callStatic.calculateMarketCap(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(bonding, "InvalidToken");
    });

    it("Should revert when calculate market cap with invalid token price", async () => {
      const oldPrice = await oracle.callStatic.getAssetPrice();
      console.log("old price", oldPrice.toString());

      await oracle.setAssetPrice(0);
      expect(await oracle.callStatic.getAssetPrice()).to.be.eq(0);

      await expect(
        bonding.callStatic.calculateMarketCap(token.address)
      ).to.be.revertedWithCustomError(bonding, "InvalidAssetPrice");

      // Restore the price
      await oracle.setAssetPrice(oldPrice);
    });
  });

  describe("getTokenData", () => {
    let start: BigNumber;
    before(async () => {
      start = await bonding.getTokenCount();
    });

    it("Should get token data for a range of tokens", async () => {
      // Launch multiple tokens
      for (let i = 0; i <= 4; i++) {
        await users[0].bonding.launch(
          `Token ${i}`,
          `TKN${i}`,
          [1, 2, 3],
          `Description ${i}`,
          "test-image.png",
          ["url1", "url2", "url3", "url4"],
          ethers.utils.parseEther("10")
        );
      }

      // Get all tokens (start=0, size=4 including the graduated token)
      const tokens = await reader.getTokenData(start, 4);
      expect(tokens.length).to.equal(4);

      // Check launched tokens
      for (let i = 0; i < 4; i++) {
        expect(tokens[i].status).to.eq(1);
        expect(tokens[i].description).to.equal(`Description ${i}`);
        expect(tokens[i].name).to.equal(`Token ${i}` + " by InteNet");
        expect(tokens[i].ticker).to.equal(`TKN${i}`);
      }
    });

    it("Should get a partial range", async () => {
      const partialTokens = await reader.getTokenData(1, 2);
      expect(partialTokens.length).to.equal(2);
    });

    it("Should get empty results when out of bounds", async () => {
      const emptyTokens = await reader.getTokenData(start.add(10), 1);
      expect(emptyTokens.length).to.equal(0);
    });
  });

  describe("calculateInitialPurchaseAmount", () => {
    async function calculateInitialPurchaseAmountOut(
      purchaseAmount: BigNumber
    ) {
      const fee = await bonding.fee();
      let initialPurchase = purchaseAmount.sub(fee);
      const buyFee = initialPurchase.mul(await factory.buyFee()).div(100);
      initialPurchase = initialPurchase.sub(buyFee);

      // Get initial reserves from contract parameters
      const initialSupply = await bonding.initialSupply();
      const initialMarketCap = await bonding.initialMarketCap();
      const assetPrice = await oracle.callStatic.getAssetPrice();
      const initialAssetReserve = initialMarketCap
        .mul(ethers.utils.parseEther("1"))
        .div(assetPrice);

      // Token amount calculation:
      // tokenAmount = initialSupply - (initialAssetReserve * initialSupply) / (initialAssetReserve + initialPurchase)
      return initialSupply.sub(
        initialAssetReserve
          .mul(initialSupply)
          .div(initialAssetReserve.add(initialPurchase))
      );
    }

    async function calculateInitialPurchaseAmountIn(receiveAmount: BigNumber) {
      // Get initial reserves from contract parameters
      const initialSupply = await bonding.initialSupply();
      const initialMarketCap = await bonding.initialMarketCap();
      const assetPrice = await oracle.callStatic.getAssetPrice();
      const initialAssetReserve = initialMarketCap
        .mul(ethers.utils.parseEther("1"))
        .div(assetPrice);

      // Token amount calculation:
      // purchaseAmount = (initialAssetReserve * initialSupply) / (initialSupply - receiveAmount) - initialAssetReserve
      var purchaseAmount = initialAssetReserve
        .mul(initialSupply)
        .div(initialSupply.sub(receiveAmount))
        .sub(initialAssetReserve);

      const fee = await bonding.fee();
      const tax = await factory.buyFee();
      purchaseAmount = purchaseAmount
        .mul(100)
        .div(BigNumber.from(100).sub(tax));
      purchaseAmount = purchaseAmount.add(fee);

      return purchaseAmount;
    }

    it("Should calculate correct token amount from initial purchase", async () => {
      const purchaseAmount = ethers.utils.parseEther("10.01");
      const expectedTokens = await calculateInitialPurchaseAmountOut(
        purchaseAmount
      );

      // Launch a token with initial purchase
      const tx = await users[0].bonding.launch(
        "Test Token",
        "TEST",
        [1, 2, 3],
        "Test Description",
        "test.png",
        ["twitter.com", "t.me", "farcaster.com", "test.com"],
        purchaseAmount
      );

      // Get the token address from the Launched event
      const receipt = await tx.wait();
      const event = receipt.events?.find(
        (e: {event: string}) => e.event === "Launched"
      );
      const tokenAddress = event?.args?.[0];

      // Get token balance of user after launch
      const token = await ethers.getContractAt("INTERC20", tokenAddress);
      const userBalance = await token.balanceOf(users[0].address);

      // console.log(utils.formatEther(expectedTokens));

      expect(userBalance).to.be.eq(expectedTokens);
    });

    it("Should calculate correct amount in from initial purchase", async () => {
      const receiveAmount = ethers.utils.parseEther("200000000");
      const amountIn = await calculateInitialPurchaseAmountIn(receiveAmount);

      // Launch a token with initial purchase
      const tx = await users[0].bonding.launch(
        "Test Token",
        "TEST",
        [1, 2, 3],
        "Test Description",
        "test.png",
        ["twitter.com", "t.me", "farcaster.com", "test.com"],
        amountIn
      );

      // Get the token address from the Launched event
      const receipt = await tx.wait();
      const event = receipt.events?.find(
        (e: {event: string}) => e.event === "Launched"
      );
      const tokenAddress = event?.args?.[0];

      // Get token balance of user after launch
      const token = await ethers.getContractAt("INTERC20", tokenAddress);
      const userBalance = await token.balanceOf(users[0].address);

      // console.log(utils.formatEther(expectedTokens));

      expect(userBalance).to.be.eq(receiveAmount);
    });
  });

  describe("INT ERC20", () => {
    it("Should revert when general user excludes account", async () => {
      const signer = await ethers.getSigner(users[0].address);

      await expect(
        token.connect(signer).excludeAccount(users[1].address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert when general user enables transfer", async () => {
      const signer = await ethers.getSigner(users[0].address);

      await expect(token.connect(signer).enableTransfer()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
