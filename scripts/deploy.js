require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\n=== Deploying to ${network.toUpperCase()} network ===\n`);

  // Check if private key is set (unless using hardhat/localhost)
  if (!process.env.PRIVATE_KEY && network !== "hardhat" && network !== "localhost") {
    console.error("ERROR: PRIVATE_KEY environment variable is not set!");
    console.error("\nTo deploy, you need to:");
    console.error("1. Create a .env file in the project root");
    console.error("2. Add your private key: PRIVATE_KEY=your_private_key_here");
    console.error("3. Or export it: export PRIVATE_KEY=your_private_key_here");
    console.error("\nFor Arc Network, you'll also need USDC for gas fees.");
    console.error("Get testnet USDC from: https://faucet.circle.com");
    process.exit(1);
  }

  // Test network connection
  try {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log("✓ Connected to network. Current block:", blockNumber);
  } catch (error) {
    console.error("✗ Error connecting to network:", error.message);
    console.error("\nPossible issues:");
    console.error("1. RPC URL is incorrect or unreachable");
    console.error("2. Network is down");
    console.error("3. Check your internet connection");
    console.error("\nFor Arc Testnet, try: npm run deploy -- --network arcTestnet");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  try {
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const balanceFormatted = hre.ethers.formatEther(balance);
    console.log("Account balance:", balanceFormatted, "ETH");
    
    // Check if balance is sufficient (at least 0.001 ETH equivalent)
    if (balance < hre.ethers.parseEther("0.001")) {
      console.warn("\n⚠ WARNING: Low balance! You may need USDC for gas on Arc Network.");
      console.warn("Arc Network uses USDC as gas. Get testnet USDC from: https://faucet.circle.com");
    }
  } catch (error) {
    console.error("Error fetching balance:", error.message);
  }

  // Deploy Interest Rate Model
  console.log("\nDeploying InterestRateModel...");
  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  console.log("InterestRateModel deployed to:", await interestRateModel.getAddress());

  // Deploy Collateral Manager
  console.log("\nDeploying CollateralManager...");
  const CollateralManager = await hre.ethers.getContractFactory("CollateralManager");
  const collateralManager = await CollateralManager.deploy();
  await collateralManager.waitForDeployment();
  console.log("CollateralManager deployed to:", await collateralManager.getAddress());

  // Deploy Lending Pool
  console.log("\nDeploying LendingPool...");
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    await interestRateModel.getAddress(),
    await collateralManager.getAddress()
  );
  await lendingPool.waitForDeployment();
  console.log("LendingPool deployed to:", await lendingPool.getAddress());

  // Deploy Delivery vs Payment
  console.log("\nDeploying DeliveryVsPayment...");
  const DeliveryVsPayment = await hre.ethers.getContractFactory("DeliveryVsPayment");
  const dvp = await DeliveryVsPayment.deploy();
  await dvp.waitForDeployment();
  console.log("DeliveryVsPayment deployed to:", await dvp.getAddress());

  // Deploy Settlement Engine
  console.log("\nDeploying SettlementEngine...");
  const SettlementEngine = await hre.ethers.getContractFactory("SettlementEngine");
  const settlementEngine = await SettlementEngine.deploy(await dvp.getAddress());
  await settlementEngine.waitForDeployment();
  console.log("SettlementEngine deployed to:", await settlementEngine.getAddress());

  // Deploy FX Pools for different token pairs on Arc Network
  console.log("\nDeploying FXPools...");
  const FXPool = await hre.ethers.getContractFactory("FXPool");
  
  // Arc Network token addresses
  const usdcAddress = "0x3600000000000000000000000000000000000000"; // USDC ERC-20 interface
  const eurcAddress = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"; // EURC
  const usycAddress = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C"; // USYC
  
  // Deploy USDC/EURC pool
  console.log("\nDeploying FXPool (USDC/EURC)...");
  const fxPoolUSDC_EURC = await FXPool.deploy(usdcAddress, eurcAddress);
  await fxPoolUSDC_EURC.waitForDeployment();
  console.log("FXPool (USDC/EURC) deployed to:", await fxPoolUSDC_EURC.getAddress());
  console.log("  Token A (USDC):", usdcAddress);
  console.log("  Token B (EURC):", eurcAddress);
  
  // Deploy USDC/USYC pool
  console.log("\nDeploying FXPool (USDC/USYC)...");
  const fxPoolUSDC_USYC = await FXPool.deploy(usdcAddress, usycAddress);
  await fxPoolUSDC_USYC.waitForDeployment();
  console.log("FXPool (USDC/USYC) deployed to:", await fxPoolUSDC_USYC.getAddress());
  console.log("  Token A (USDC):", usdcAddress);
  console.log("  Token B (USYC):", usycAddress);
  
  // Deploy EURC/USYC pool
  console.log("\nDeploying FXPool (EURC/USYC)...");
  const fxPoolEURC_USYC = await FXPool.deploy(eurcAddress, usycAddress);
  await fxPoolEURC_USYC.waitForDeployment();
  console.log("FXPool (EURC/USYC) deployed to:", await fxPoolEURC_USYC.getAddress());
  console.log("  Token A (EURC):", eurcAddress);
  console.log("  Token B (USYC):", usycAddress);
  
  // Keep the first pool as the default for backward compatibility
  const fxPool = fxPoolUSDC_EURC;

  // Deploy Stablecoin Swap
  console.log("\nDeploying StablecoinSwap...");
  const StablecoinSwap = await hre.ethers.getContractFactory("StablecoinSwap");
  const stablecoinSwap = await StablecoinSwap.deploy();
  await stablecoinSwap.waitForDeployment();
  console.log("StablecoinSwap deployed to:", await stablecoinSwap.getAddress());

  // Deploy Liquidity Aggregator
  console.log("\nDeploying LiquidityAggregator...");
  const LiquidityAggregator = await hre.ethers.getContractFactory("LiquidityAggregator");
  const liquidityAggregator = await LiquidityAggregator.deploy();
  await liquidityAggregator.waitForDeployment();
  console.log("LiquidityAggregator deployed to:", await liquidityAggregator.getAddress());

  // Deploy Payment Router
  console.log("\nDeploying PaymentRouter...");
  const PaymentRouter = await hre.ethers.getContractFactory("PaymentRouter");
  const paymentRouter = await PaymentRouter.deploy();
  await paymentRouter.waitForDeployment();
  console.log("PaymentRouter deployed to:", await paymentRouter.getAddress());

  // Deploy Institutional Settlement
  console.log("\nDeploying InstitutionalSettlement...");
  const InstitutionalSettlement = await hre.ethers.getContractFactory("InstitutionalSettlement");
  const institutionalSettlement = await InstitutionalSettlement.deploy(deployer.address);
  await institutionalSettlement.waitForDeployment();
  console.log("InstitutionalSettlement deployed to:", await institutionalSettlement.getAddress());

  console.log("\n=== Deployment Summary ===");
  console.log("InterestRateModel:", await interestRateModel.getAddress());
  console.log("CollateralManager:", await collateralManager.getAddress());
  console.log("LendingPool:", await lendingPool.getAddress());
  console.log("DeliveryVsPayment:", await dvp.getAddress());
  console.log("SettlementEngine:", await settlementEngine.getAddress());
  console.log("FXPool (USDC/EURC):", await fxPoolUSDC_EURC.getAddress());
  console.log("FXPool (USDC/USYC):", await fxPoolUSDC_USYC.getAddress());
  console.log("FXPool (EURC/USYC):", await fxPoolEURC_USYC.getAddress());
  console.log("StablecoinSwap:", await stablecoinSwap.getAddress());
  console.log("LiquidityAggregator:", await liquidityAggregator.getAddress());
  console.log("PaymentRouter:", await paymentRouter.getAddress());
  console.log("InstitutionalSettlement:", await institutionalSettlement.getAddress());
  console.log("\n=== FXPool Addresses (for frontend config) ===");
  console.log("Default FXPool (USDC/EURC):", await fxPool.getAddress());
  console.log("USDC/USYC Pool:", await fxPoolUSDC_USYC.getAddress());
  console.log("EURC/USYC Pool:", await fxPoolEURC_USYC.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

