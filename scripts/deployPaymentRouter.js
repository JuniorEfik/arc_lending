require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  console.log(`\n=== Deploying PaymentRouter to ${network.toUpperCase()} network ===\n`);

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
  
  try {
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const balanceFormatted = hre.ethers.formatEther(balance);
    console.log("Account balance:", balanceFormatted, "ETH");
  } catch (error) {
    console.error("Error fetching balance:", error.message);
  }

  console.log("\n--- Deploying PaymentRouter ---");
  
  try {
    const PaymentRouter = await hre.ethers.getContractFactory("PaymentRouter");
    console.log("Deploying PaymentRouter...");
    
    const paymentRouter = await PaymentRouter.deploy();
    await paymentRouter.waitForDeployment();
    
    const paymentRouterAddress = await paymentRouter.getAddress();
    console.log("\n✓ PaymentRouter deployed successfully!");
    console.log("  Address:", paymentRouterAddress);
    
    // Get deployment transaction
    const deployTx = paymentRouter.deploymentTransaction();
    if (deployTx) {
      console.log("  Transaction hash:", deployTx.hash);
      const receipt = await deployTx.wait();
      console.log("  Block number:", receipt.blockNumber);
      console.log("  Gas used:", receipt.gasUsed.toString());
    }

    // Update frontend config
    const contractsConfigPath = path.join(__dirname, "../frontend/config/contracts.ts");
    let contractsConfig = fs.readFileSync(contractsConfigPath, "utf8");
    
    // Replace the paymentRouter address
    const oldAddressRegex = /paymentRouter:\s*'0x[a-fA-F0-9]+'/;
    const newAddress = `paymentRouter: '${paymentRouterAddress}'`;
    
    if (oldAddressRegex.test(contractsConfig)) {
      contractsConfig = contractsConfig.replace(oldAddressRegex, newAddress);
      fs.writeFileSync(contractsConfigPath, contractsConfig);
      console.log("\n✓ Updated frontend/config/contracts.ts with new PaymentRouter address");
    } else {
      console.log("\n⚠ Could not find paymentRouter address in contracts.ts to update");
      console.log("  Please manually update frontend/config/contracts.ts:");
      console.log(`  paymentRouter: '${paymentRouterAddress}'`);
    }

    console.log("\n=== Deployment Summary ===");
    console.log("PaymentRouter Address:", paymentRouterAddress);
    console.log("\nNext steps:");
    console.log("1. Verify the contract on the block explorer");
    console.log("2. Test the cancelPayment function");
    console.log("3. Update any other references to the old PaymentRouter address");
    
  } catch (error) {
    console.error("\n✗ Deployment failed:", error);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


