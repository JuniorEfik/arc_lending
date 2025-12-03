require("dotenv").config();
const hre = require("hardhat");

/**
 * Script to register FX pools in StablecoinSwap contract
 * Run this after deploying new FXPool contracts
 */
async function main() {
  const network = hre.network.name;
  console.log(`\n=== Registering FX pools in StablecoinSwap on ${network.toUpperCase()} network ===\n`);

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
  console.log("Registering pools with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // StablecoinSwap contract address
  const stablecoinSwapAddress = "0x36d6b857541dBc4c41d0913452a94f669fbE3869";
  
  // Pool addresses (newly deployed)
  const pools = [
    {
      address: "0x8C16EfD6d477D2BA48eba504a870Bb1f4fe59082",
      name: "USDC/EURC",
      tokenA: "0x3600000000000000000000000000000000000000", // USDC
      tokenB: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC
    },
    {
      address: "0x1fCf906eD8Ce3220c325404c33F0ed169012beEe",
      name: "USDC/USYC",
      tokenA: "0x3600000000000000000000000000000000000000", // USDC
      tokenB: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", // USYC
    },
    {
      address: "0x28AB2A10ac0Ee3De1286BfBc41e59a7255AcF392",
      name: "EURC/USYC",
      tokenA: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC
      tokenB: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", // USYC
    },
  ];

  // Get StablecoinSwap contract
  const StablecoinSwap = await hre.ethers.getContractFactory("StablecoinSwap");
  const stablecoinSwap = StablecoinSwap.attach(stablecoinSwapAddress);

  // Check if deployer is owner
  try {
    const owner = await stablecoinSwap.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error(`✗ ERROR: You are not the owner of StablecoinSwap contract. Owner: ${owner}`);
      console.error(`   Deployer: ${deployer.address}`);
      process.exit(1);
    }
    console.log("✓ Confirmed as owner of StablecoinSwap contract\n");
  } catch (error) {
    console.error("✗ Error checking ownership:", error.message);
    process.exit(1);
  }

  // Register each pool
  for (const poolInfo of pools) {
    try {
      console.log(`Registering ${poolInfo.name} pool...`);
      console.log(`  Pool address: ${poolInfo.address}`);
      console.log(`  Token A: ${poolInfo.tokenA}`);
      console.log(`  Token B: ${poolInfo.tokenB}`);

      // Check if pool is already registered
      const existingPool = await stablecoinSwap.pools(poolInfo.tokenA, poolInfo.tokenB);
      if (existingPool.toLowerCase() === poolInfo.address.toLowerCase()) {
        console.log(`  ✓ Pool is already registered with this address\n`);
        continue;
      }

      // Register the pool
      const tx = await stablecoinSwap.registerPool(
        poolInfo.address,
        poolInfo.tokenA,
        poolInfo.tokenB
      );
      console.log(`  Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✓ Pool registered in block: ${receipt.blockNumber}\n`);
    } catch (error) {
      console.error(`  ✗ Error registering ${poolInfo.name}:`, error.message);
      if (error.reason) {
        console.error(`    Revert reason: ${error.reason}`);
      }
    }
  }

  console.log("=== Pool registration complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

