require("dotenv").config();
const hre = require("hardhat");

/**
 * Script to get the admin address from PRIVATE_KEY
 * This address is derived from the private key used for deployment
 */
async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error("ERROR: PRIVATE_KEY environment variable is not set!");
    process.exit(1);
  }

  // Create wallet from private key
  const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
  const adminAddress = wallet.address;

  console.log("\n=== Admin Address ===");
  console.log(`Admin Address: ${adminAddress}`);
  console.log("\nTo use this in the frontend, add to frontend/.env.local:");
  console.log(`NEXT_PUBLIC_ADMIN_ADDRESS=${adminAddress}`);
  console.log("\nOr set it in your deployment environment:");
  console.log(`ADMIN_ADDRESS=${adminAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


