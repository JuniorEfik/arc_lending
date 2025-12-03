require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const pools = [
    { name: "USDC/EURC", address: "0x8C16EfD6d477D2BA48eba504a870Bb1f4fe59082" },
    { name: "USDC/USYC", address: "0x1fCf906eD8Ce3220c325404c33F0ed169012beEe" },
    { name: "EURC/USYC", address: "0x28AB2A10ac0Ee3De1286BfBc41e59a7255AcF392" },
  ];

  const FXPool = await hre.ethers.getContractFactory("FXPool");

  for (const poolInfo of pools) {
    try {
      const pool = FXPool.attach(poolInfo.address);
      const tokenA = await pool.tokenA();
      const tokenB = await pool.tokenB();
      
      console.log(`\n${poolInfo.name} Pool (${poolInfo.address}):`);
      console.log(`  Token A: ${tokenA}`);
      console.log(`  Token B: ${tokenB}`);
    } catch (error) {
      console.error(`Error checking ${poolInfo.name}:`, error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

