require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Script to withdraw all liquidity from FXPool contracts
 * This should be run before deploying new pool contracts
 */
async function main() {
  const network = hre.network.name;
  console.log(`\n=== Withdrawing All Liquidity from FXPool on ${network.toUpperCase()} ===\n`);

  // Check if private key is set
  if (!process.env.PRIVATE_KEY && network !== "hardhat" && network !== "localhost") {
    console.error("ERROR: PRIVATE_KEY environment variable is not set!");
    process.exit(1);
  }

  // Test network connection
  try {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log("✓ Connected to network. Current block:", blockNumber);
  } catch (error) {
    console.error("✗ Error connecting to network:", error.message);
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Withdrawing with account:", deployer.address);
  
  try {
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const balanceFormatted = hre.ethers.formatEther(balance);
    console.log("Account balance:", balanceFormatted, "ETH");
  } catch (error) {
    console.error("Error fetching balance:", error.message);
  }

  // Pool addresses from config
  const pools = {
    usdcEurc: '0x8C16EfD6d477D2BA48eba504a870Bb1f4fe59082',
    usdcUsyc: '0x1fCf906eD8Ce3220c325404c33F0ed169012beEe',
    eurcUsyc: '0x28AB2A10ac0Ee3De1286BfBc41e59a7255AcF392',
  };

  // Get FXPool ABI
  const FXPoolABI = [
    "function getReserves() external view returns (uint256, uint256)",
    "function tokenA() external view returns (address)",
    "function tokenB() external view returns (address)",
    "function owner() external view returns (address)",
    "function withdrawAllLiquidity(address recipient) external",
  ];

  const recipient = deployer.address; // Withdraw to deployer address

  for (const [poolName, poolAddress] of Object.entries(pools)) {
    console.log(`\n--- Processing ${poolName.toUpperCase()} Pool ---`);
    console.log(`Pool Address: ${poolAddress}`);
    
    try {
      const fxPool = new hre.ethers.Contract(poolAddress, FXPoolABI, deployer);
      
      // Check if caller is owner
      const owner = await fxPool.owner();
      console.log(`Pool Owner: ${owner}`);
      
      if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`⚠ Skipping: You are not the owner of this pool`);
        continue;
      }
      
      // Get current reserves
      const [reserveA, reserveB] = await fxPool.getReserves();
      const tokenA = await fxPool.tokenA();
      const tokenB = await fxPool.tokenB();
      
      console.log(`Current Reserves:`);
      console.log(`  Token A: ${reserveA.toString()}`);
      console.log(`  Token B: ${reserveB.toString()}`);
      
      if (reserveA === 0n && reserveB === 0n) {
        console.log(`✓ Pool is already empty, skipping...`);
        continue;
      }
      
      // Get token info for display
      const ERC20ABI = [
        "function symbol() external view returns (string)",
        "function decimals() external view returns (uint8)",
      ];
      
      let tokenASymbol = 'TokenA';
      let tokenBSymbol = 'TokenB';
      let tokenADecimals = 18;
      let tokenBDecimals = 18;
      
      try {
        const tokenAContract = new hre.ethers.Contract(tokenA, ERC20ABI, deployer);
        const tokenBContract = new hre.ethers.Contract(tokenB, ERC20ABI, deployer);
        tokenASymbol = await tokenAContract.symbol();
        tokenBSymbol = await tokenBContract.symbol();
        tokenADecimals = await tokenAContract.decimals();
        tokenBDecimals = await tokenBContract.decimals();
      } catch (error) {
        console.warn("Could not fetch token info:", error.message);
      }
      
      const formattedReserveA = hre.ethers.formatUnits(reserveA, tokenADecimals);
      const formattedReserveB = hre.ethers.formatUnits(reserveB, tokenBDecimals);
      
      console.log(`\nWithdrawing:`);
      console.log(`  ${formattedReserveA} ${tokenASymbol}`);
      console.log(`  ${formattedReserveB} ${tokenBSymbol}`);
      console.log(`  To: ${recipient}`);
      
      // Confirm before withdrawing
      console.log(`\n⚠ WARNING: This will withdraw ALL liquidity from the pool!`);
      console.log(`Press Ctrl+C to cancel, or wait 5 seconds to continue...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Withdraw all liquidity
      console.log(`\nWithdrawing all liquidity...`);
      const tx = await fxPool.withdrawAllLiquidity(recipient);
      console.log(`Transaction hash: ${tx.hash}`);
      console.log(`Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`✓ Liquidity withdrawn successfully!`);
      console.log(`  Block: ${receipt.blockNumber}`);
      console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
      
      // Verify reserves are now zero
      const [newReserveA, newReserveB] = await fxPool.getReserves();
      console.log(`\nNew Reserves:`);
      console.log(`  Token A: ${newReserveA.toString()}`);
      console.log(`  Token B: ${newReserveB.toString()}`);
      
      if (newReserveA === 0n && newReserveB === 0n) {
        console.log(`✓ Pool is now empty`);
      } else {
        console.log(`⚠ Warning: Pool still has reserves`);
      }
      
    } catch (error) {
      console.error(`✗ Error processing ${poolName}:`, error.message);
      if (error.reason) {
        console.error(`  Reason: ${error.reason}`);
      }
      // Continue with next pool
    }
  }

  console.log("\n=== Withdrawal Complete ===");
  console.log("\nNext steps:");
  console.log("1. Deploy new FXPool contracts: npm run deploy:pools -- --network arc");
  console.log("2. Register new pools: npm run register:pools -- --network arc");
  console.log("3. Update frontend config with new addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

