require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Contract addresses from frontend config
const CONTRACT_ADDRESSES = {
  interestRateModel: '0xBDbbFdeefFE255a3096fa8DdE092EEb1d9ffFa2e',
  collateralManager: '0x12486F005DcAf95389d39F889A09878EB135F3fF',
  lendingPool: '0xF39000e8F76123fF1A838489A1f37C6c85d3d3D5',
  deliveryVsPayment: '0xE095e7ae70a90312ce2FeC0245301193AA9F3376',
  settlementEngine: '0x35100298873d63E8FE8dC5937DFfec8416279794',
  fxPool: '0x8C16EfD6d477D2BA48eba504a870Bb1f4fe59082',
  stablecoinSwap: '0x36d6b857541dBc4c41d0913452a94f669fbE3869',
  liquidityAggregator: '0x67c034cED1D093a0568fb262c46aF38D5D76Cd66',
  paymentRouter: '0xC3a2951D2acC6Bc7e80D2173EC63a6F2760654cf',
  institutionalSettlement: '0x0Ea4FD4ad3bB2d5FCF156Cc25A5ED53E134f20B2',
};

// Contract names mapping
const CONTRACT_NAMES = {
  interestRateModel: 'InterestRateModel',
  collateralManager: 'CollateralManager',
  lendingPool: 'LendingPool',
  deliveryVsPayment: 'DeliveryVsPayment',
  settlementEngine: 'SettlementEngine',
  fxPool: 'FXPool',
  stablecoinSwap: 'StablecoinSwap',
  liquidityAggregator: 'LiquidityAggregator',
  paymentRouter: 'PaymentRouter',
  institutionalSettlement: 'InstitutionalSettlement',
};

// Get constructor arguments dynamically
function getConstructorArgs(adminAddress) {
  return {
    interestRateModel: [],
    collateralManager: [],
    lendingPool: ['0xBDbbFdeefFE255a3096fa8DdE092EEb1d9ffFa2e', '0x12486F005DcAf95389d39F889A09878EB135F3fF'], // interestRateModel, collateralManager
    deliveryVsPayment: [],
    settlementEngine: ['0xE095e7ae70a90312ce2FeC0245301193AA9F3376'], // dvp address
    fxPool: ['0x3600000000000000000000000000000000000000', '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'], // USDC, EURC
    stablecoinSwap: [],
    liquidityAggregator: [],
    paymentRouter: [],
    institutionalSettlement: [adminAddress], // admin address (from PRIVATE_KEY)
  };
}

async function verifyContract(name, address, constructorArgs = []) {
  try {
    console.log(`\n--- Verifying ${name} ---`);
    console.log(`Address: ${address}`);
    
    if (constructorArgs.length > 0) {
      console.log(`Constructor args: ${JSON.stringify(constructorArgs)}`);
    }

    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    });
    
    console.log(`✓ ${name} verified successfully!`);
    return 'verified';
  } catch (error) {
    if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
      console.log(`✓ ${name} is already verified`);
      return 'alreadyVerified';
    } else {
      console.error(`✗ Failed to verify ${name}:`, error.message);
      return 'failed';
    }
  }
}

async function main() {
  const network = hre.network.name;
  console.log(`\n=== Verifying Contracts on ${network.toUpperCase()} ===\n`);

  if (network === "hardhat" || network === "localhost") {
    console.error("Cannot verify contracts on local network");
    process.exit(1);
  }

  // Check if ETHERSCAN_API_KEY is set (some explorers use etherscan-compatible API)
  if (!process.env.ETHERSCAN_API_KEY && !process.env.ARC_EXPLORER_API_KEY) {
    console.warn("⚠ WARNING: ETHERSCAN_API_KEY or ARC_EXPLORER_API_KEY not set");
    console.warn("Some block explorers may require an API key for verification");
    console.warn("Check the Arc Network explorer documentation for API key requirements");
  }

  // Get admin address from PRIVATE_KEY
  let adminAddress = '0xe36e9dDA48a431c8394893688ECE63896368360f'; // Default
  if (process.env.PRIVATE_KEY) {
    try {
      const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
      adminAddress = wallet.address;
      console.log(`Using admin address from PRIVATE_KEY: ${adminAddress}`);
    } catch (error) {
      console.warn(`Could not derive admin address from PRIVATE_KEY, using default: ${adminAddress}`);
    }
  }

  const CONSTRUCTOR_ARGS = getConstructorArgs(adminAddress);

  const results = {
    verified: [],
    failed: [],
    alreadyVerified: [],
  };

  // Verify each contract
  for (const [key, address] of Object.entries(CONTRACT_ADDRESSES)) {
    const contractName = CONTRACT_NAMES[key];
    const constructorArgs = CONSTRUCTOR_ARGS[key] || [];
    
    const result = await verifyContract(contractName, address, constructorArgs);
    
    if (result === 'verified') {
      results.verified.push(key);
    } else if (result === 'alreadyVerified') {
      results.alreadyVerified.push(key);
    } else {
      results.failed.push(key);
    }
    
    // Add delay between verifications to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log("\n=== Verification Summary ===");
  console.log(`✓ Verified: ${results.verified.length}`);
  console.log(`✓ Already verified: ${results.alreadyVerified.length}`);
  console.log(`✗ Failed: ${results.failed.length}`);
  
  if (results.verified.length > 0) {
    console.log("\nNewly verified contracts:");
    results.verified.forEach(key => {
      console.log(`  - ${CONTRACT_NAMES[key]}: ${CONTRACT_ADDRESSES[key]}`);
    });
  }
  
  if (results.alreadyVerified.length > 0) {
    console.log("\nAlready verified contracts:");
    results.alreadyVerified.forEach(key => {
      console.log(`  - ${CONTRACT_NAMES[key]}: ${CONTRACT_ADDRESSES[key]}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log("\nFailed to verify:");
    results.failed.forEach(key => {
      console.log(`  - ${CONTRACT_NAMES[key]}: ${CONTRACT_ADDRESSES[key]}`);
      console.log(`    View on explorer: https://explorer.testnet.arc.network/address/${CONTRACT_ADDRESSES[key]}`);
    });
  }

  console.log("\n=== Block Explorer Links ===");
  console.log("Arc Testnet Explorer: https://explorer.testnet.arc.network");
  console.log("\nContract addresses:");
  Object.entries(CONTRACT_ADDRESSES).forEach(([key, address]) => {
    console.log(`  ${CONTRACT_NAMES[key]}: https://explorer.testnet.arc.network/address/${address}`);
  });

  console.log("\n=== Manual Verification Instructions ===");
  console.log("If automated verification failed, you can verify manually:");
  console.log("1. Visit https://explorer.testnet.arc.network");
  console.log("2. Search for each contract address");
  console.log("3. Click 'Verify Contract' or 'Contract' tab");
  console.log("4. Fill in the verification form with:");
  console.log("   - Compiler: 0.8.20");
  console.log("   - Optimization: Enabled (200 runs)");
  console.log("   - Constructor arguments (see VERIFICATION_GUIDE.md)");
  console.log("   - Source code (use: npx hardhat flatten contracts/[ContractName].sol)");
  console.log("\nSee VERIFICATION_GUIDE.md for detailed instructions and constructor arguments.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

