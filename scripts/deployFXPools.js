require("dotenv").config();
const hre = require("hardhat");

/**
 * Script to deploy only FXPool contracts
 * This is useful when you need to redeploy pools with new functionality
 */
async function main() {
  const network = hre.network.name;
  console.log(`\n=== Deploying FXPool contracts on ${network.toUpperCase()} network ===\n`);

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
  console.log("Deploying with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Token addresses on Arc Network
  const usdcAddress = "0x3600000000000000000000000000000000000000"; // USDC on Arc Network
  const eurcAddress = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"; // EURC on Arc Network
  const usycAddress = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C"; // USYC on Arc Network

  // Deploy FX Pools
  console.log("Deploying FXPools...");
  const FXPool = await hre.ethers.getContractFactory("FXPool");

  // USDC/EURC Pool
  console.log("\nDeploying FXPool (USDC/EURC)...");
  const fxPoolUsdcEurc = await FXPool.deploy(usdcAddress, eurcAddress);
  await fxPoolUsdcEurc.waitForDeployment();
  const usdcEurcAddress = await fxPoolUsdcEurc.getAddress();
  console.log("✓ FXPool (USDC/EURC) deployed to:", usdcEurcAddress);
  console.log("  Token A (USDC):", usdcAddress);
  console.log("  Token B (EURC):", eurcAddress);

  // USDC/USYC Pool
  console.log("\nDeploying FXPool (USDC/USYC)...");
  const fxPoolUsdcUsyc = await FXPool.deploy(usdcAddress, usycAddress);
  await fxPoolUsdcUsyc.waitForDeployment();
  const usdcUsycAddress = await fxPoolUsdcUsyc.getAddress();
  console.log("✓ FXPool (USDC/USYC) deployed to:", usdcUsycAddress);
  console.log("  Token A (USDC):", usdcAddress);
  console.log("  Token B (USYC):", usycAddress);

  // EURC/USYC Pool
  console.log("\nDeploying FXPool (EURC/USYC)...");
  const fxPoolEurcUsyc = await FXPool.deploy(eurcAddress, usycAddress);
  await fxPoolEurcUsyc.waitForDeployment();
  const eurcUsycAddress = await fxPoolEurcUsyc.getAddress();
  console.log("✓ FXPool (EURC/USYC) deployed to:", eurcUsycAddress);
  console.log("  Token A (EURC):", eurcAddress);
  console.log("  Token B (USYC):", usycAddress);

  // Deployment Summary
  console.log("\n=== Deployment Summary ===");
  console.log("FXPool (USDC/EURC):", usdcEurcAddress);
  console.log("FXPool (USDC/USYC):", usdcUsycAddress);
  console.log("FXPool (EURC/USYC):", eurcUsycAddress);
  console.log("\n⚠ IMPORTANT: Update the following files with the new addresses:");
  console.log("  1. frontend/config/contracts.ts");
  console.log("  2. scripts/rebalancePools.js (or set environment variables)");
  console.log("\nEnvironment variables you can set:");
  console.log(`  FXPOOL_USDC_EURC=${usdcEurcAddress}`);
  console.log(`  FXPOOL_USDC_USYC=${usdcUsycAddress}`);
  console.log(`  FXPOOL_EURC_USYC=${eurcUsycAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


