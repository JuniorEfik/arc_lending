require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Script to deploy FXPool contracts and automatically update all necessary files
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
  const usdcAddress = "0x3600000000000000000000000000000000000000";
  const eurcAddress = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
  const usycAddress = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C";

  // Deploy FX Pools
  console.log("Deploying FXPools...");
  const FXPool = await hre.ethers.getContractFactory("FXPool");

  // USDC/EURC Pool
  console.log("\nDeploying FXPool (USDC/EURC)...");
  const fxPoolUsdcEurc = await FXPool.deploy(usdcAddress, eurcAddress);
  await fxPoolUsdcEurc.waitForDeployment();
  const usdcEurcAddress = await fxPoolUsdcEurc.getAddress();
  console.log("✓ FXPool (USDC/EURC) deployed to:", usdcEurcAddress);

  // USDC/USYC Pool
  console.log("\nDeploying FXPool (USDC/USYC)...");
  const fxPoolUsdcUsyc = await FXPool.deploy(usdcAddress, usycAddress);
  await fxPoolUsdcUsyc.waitForDeployment();
  const usdcUsycAddress = await fxPoolUsdcUsyc.getAddress();
  console.log("✓ FXPool (USDC/USYC) deployed to:", usdcUsycAddress);

  // EURC/USYC Pool
  console.log("\nDeploying FXPool (EURC/USYC)...");
  const fxPoolEurcUsyc = await FXPool.deploy(eurcAddress, usycAddress);
  await fxPoolEurcUsyc.waitForDeployment();
  const eurcUsycAddress = await fxPoolEurcUsyc.getAddress();
  console.log("✓ FXPool (EURC/USYC) deployed to:", eurcUsycAddress);

  // Register pools
  console.log("\n=== Registering pools ===");
  const stablecoinSwapAddress = "0x36d6b857541dBc4c41d0913452a94f669fbE3869";
  const StablecoinSwap = await hre.ethers.getContractFactory("StablecoinSwap");
  const stablecoinSwap = StablecoinSwap.attach(stablecoinSwapAddress);

  // Check if deployer is owner
  const owner = await stablecoinSwap.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("✗ Error: Deployer is not the owner of StablecoinSwap contract");
    console.error("  Owner:", owner);
    console.error("  Deployer:", deployer.address);
    process.exit(1);
  }
  console.log("✓ Confirmed as owner of StablecoinSwap contract\n");

  // Register pools
  const poolsToRegister = [
    { address: usdcEurcAddress, tokenA: usdcAddress, tokenB: eurcAddress, name: "USDC/EURC" },
    { address: usdcUsycAddress, tokenA: usdcAddress, tokenB: usycAddress, name: "USDC/USYC" },
    { address: eurcUsycAddress, tokenA: eurcAddress, tokenB: usycAddress, name: "EURC/USYC" }
  ];

  for (const pool of poolsToRegister) {
    console.log(`Registering ${pool.name} pool...`);
    console.log(`  Pool address: ${pool.address}`);
    console.log(`  Token A: ${pool.tokenA}`);
    console.log(`  Token B: ${pool.tokenB}`);
    try {
      // Check if pool is already registered
      const existingPool = await stablecoinSwap.pools(pool.tokenA, pool.tokenB);
      if (existingPool.toLowerCase() === pool.address.toLowerCase()) {
        console.log("  ⚠ Pool already registered with this address\n");
        continue;
      }
      
      // Register pool with 3 parameters: (address pool, address tokenA, address tokenB)
      const tx = await stablecoinSwap.registerPool(pool.address, pool.tokenA, pool.tokenB);
      console.log(`  Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✓ Pool registered in block: ${receipt.blockNumber}\n`);
    } catch (error) {
      console.log(`  ✗ Error: ${error.message || error.reason || "Unknown error"}\n`);
    }
  }

  // Update frontend/config/contracts.ts
  console.log("\n=== Updating frontend/config/contracts.ts ===");
  const contractsPath = path.join(__dirname, "../frontend/config/contracts.ts");
  let contractsContent = fs.readFileSync(contractsPath, "utf8");
  
  // Replace all pool addresses
  contractsContent = contractsContent.replace(
    /fxPool:\s*'[^']+',\s*\/\/\s*USDC\/EURC/,
    `fxPool: '${usdcEurcAddress}', // USDC/EURC`
  );
  contractsContent = contractsContent.replace(
    /usdcEurc:\s*'[^']+',\s*\/\/\s*USDC\/EURC/,
    `usdcEurc: '${usdcEurcAddress}', // USDC/EURC`
  );
  contractsContent = contractsContent.replace(
    /usdcUsyc:\s*'[^']+',\s*\/\/\s*USDC\/USYC/,
    `usdcUsyc: '${usdcUsycAddress}', // USDC/USYC`
  );
  contractsContent = contractsContent.replace(
    /eurcUsyc:\s*'[^']+',\s*\/\/\s*EURC\/USYC/,
    `eurcUsyc: '${eurcUsycAddress}', // EURC/USYC`
  );
  
  fs.writeFileSync(contractsPath, contractsContent);
  console.log("✓ Updated frontend/config/contracts.ts");

  // Update scripts/rebalancePools.js
  console.log("\n=== Updating scripts/rebalancePools.js ===");
  const rebalancePath = path.join(__dirname, "rebalancePools.js");
  let rebalanceContent = fs.readFileSync(rebalancePath, "utf8");
  
  rebalanceContent = rebalanceContent.replace(
    /process\.env\.FXPOOL_USDC_EURC\s*\|\|\s*"[^"]+"/,
    `process.env.FXPOOL_USDC_EURC || "${usdcEurcAddress}"`
  );
  rebalanceContent = rebalanceContent.replace(
    /process\.env\.FXPOOL_USDC_USYC\s*\|\|\s*"[^"]+"/,
    `process.env.FXPOOL_USDC_USYC || "${usdcUsycAddress}"`
  );
  rebalanceContent = rebalanceContent.replace(
    /process\.env\.FXPOOL_EURC_USYC\s*\|\|\s*"[^"]+"/,
    `process.env.FXPOOL_EURC_USYC || "${eurcUsycAddress}"`
  );
  
  fs.writeFileSync(rebalancePath, rebalanceContent);
  console.log("✓ Updated scripts/rebalancePools.js");

  // Update scripts/checkPool.js
  console.log("\n=== Updating scripts/checkPool.js ===");
  const checkPoolPath = path.join(__dirname, "checkPool.js");
  let checkPoolContent = fs.readFileSync(checkPoolPath, "utf8");
  
  checkPoolContent = checkPoolContent.replace(
    /name:\s*"USDC\/EURC",\s*address:\s*"[^"]+"/,
    `name: "USDC/EURC", address: "${usdcEurcAddress}"`
  );
  checkPoolContent = checkPoolContent.replace(
    /name:\s*"USDC\/USYC",\s*address:\s*"[^"]+"/,
    `name: "USDC/USYC", address: "${usdcUsycAddress}"`
  );
  checkPoolContent = checkPoolContent.replace(
    /name:\s*"EURC\/USYC",\s*address:\s*"[^"]+"/,
    `name: "EURC/USYC", address: "${eurcUsycAddress}"`
  );
  
  fs.writeFileSync(checkPoolPath, checkPoolContent);
  console.log("✓ Updated scripts/checkPool.js");

  // Update scripts/registerPools.js
  console.log("\n=== Updating scripts/registerPools.js ===");
  const registerPoolsPath = path.join(__dirname, "registerPools.js");
  let registerPoolsContent = fs.readFileSync(registerPoolsPath, "utf8");
  
  // Find and replace each pool address
  const poolPatterns = [
    { name: "USDC/EURC", address: usdcEurcAddress },
    { name: "USDC/USYC", address: usdcUsycAddress },
    { name: "EURC/USYC", address: eurcUsycAddress }
  ];
  
  poolPatterns.forEach(pool => {
    const regex = new RegExp(`address:\\s*"[^"]+",\\s*name:\\s*"${pool.name.replace(/\//g, "\\/")}"`, "g");
    registerPoolsContent = registerPoolsContent.replace(
      regex,
      `address: "${pool.address}",\n      name: "${pool.name}"`
    );
  });
  
  fs.writeFileSync(registerPoolsPath, registerPoolsContent);
  console.log("✓ Updated scripts/registerPools.js");

  // Deployment Summary
  console.log("\n=== Deployment Summary ===");
  console.log("FXPool (USDC/EURC):", usdcEurcAddress);
  console.log("FXPool (USDC/USYC):", usdcUsycAddress);
  console.log("FXPool (EURC/USYC):", eurcUsycAddress);
  console.log("\n✓ All files have been updated with the new addresses!");
  console.log("\n⚠ Note: The new contract has a maximum swap limit of 2 tokens");
  console.log("   Error message: 'Not more than 2 tokens can be swapped'");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
