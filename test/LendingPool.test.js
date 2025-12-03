const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool", function () {
  let lendingPool;
  let interestRateModel;
  let collateralManager;
  let token;
  let owner;
  let user1;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Test Token", "TEST", ethers.parseEther("1000000"));
    await token.waitForDeployment();

    // Deploy InterestRateModel
    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestRateModel = await InterestRateModel.deploy();
    await interestRateModel.waitForDeployment();

    // Deploy CollateralManager
    const CollateralManager = await ethers.getContractFactory("CollateralManager");
    collateralManager = await CollateralManager.deploy();
    await collateralManager.waitForDeployment();

    // Deploy LendingPool
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(
      await interestRateModel.getAddress(),
      await collateralManager.getAddress()
    );
    await lendingPool.waitForDeployment();

    // Add market
    await lendingPool.addMarket(await token.getAddress(), 1000); // 10% reserve factor
  });

  describe("Deposits", function () {
    it("Should allow users to deposit tokens", async function () {
      const depositAmount = ethers.parseEther("1000");
      await token.approve(await lendingPool.getAddress(), depositAmount);
      await lendingPool.deposit(await token.getAddress(), depositAmount);

      const balance = await lendingPool.getDepositBalance(
        user1.address,
        await token.getAddress()
      );
      expect(balance).to.equal(depositAmount);
    });
  });

  describe("Borrowing", function () {
    it("Should allow borrowing with sufficient collateral", async function () {
      // First deposit collateral
      const collateralAmount = ethers.parseEther("1000");
      await token.approve(await collateralManager.getAddress(), collateralAmount);
      await collateralManager.depositCollateral(await token.getAddress(), collateralAmount);

      // Then deposit to pool
      const depositAmount = ethers.parseEther("5000");
      await token.approve(await lendingPool.getAddress(), depositAmount);
      await lendingPool.deposit(await token.getAddress(), depositAmount);

      // Now borrow
      const borrowAmount = ethers.parseEther("500");
      await lendingPool.borrow(await token.getAddress(), borrowAmount);

      const borrowBalance = await lendingPool.getBorrowBalance(
        user1.address,
        await token.getAddress()
      );
      expect(borrowBalance).to.be.gte(borrowAmount);
    });
  });
});


