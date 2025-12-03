require("dotenv").config();
const hre = require("hardhat");

/**
 * Script to automatically rebalance FX pools
 * This script checks all pools and adds one-sided liquidity if needed
 */
async function main() {
  const network = hre.network.name;
  console.log(`\n=== Rebalancing pools on ${network.toUpperCase()} network ===\n`);
  console.log(`⚠ NOTE: This script uses the rebalanceTo5050() function to achieve perfect 50:50 balance.`);
  console.log(`   Pools will be rebalanced if imbalance > 1%.\n`);

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
  const adminAddress = deployer.address;
  console.log("Rebalancing with account (admin):", adminAddress);

  // Pool addresses from deployment
  const pools = [
    {
      address: process.env.FXPOOL_USDC_EURC || "0x8C16EfD6d477D2BA48eba504a870Bb1f4fe59082",
      name: "USDC/EURC",
      tokenA: "0x3600000000000000000000000000000000000000", // USDC
      tokenB: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC
    },
    {
      address: process.env.FXPOOL_USDC_USYC || "0x1fCf906eD8Ce3220c325404c33F0ed169012beEe",
      name: "USDC/USYC",
      tokenA: "0x3600000000000000000000000000000000000000", // USDC
      tokenB: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", // USYC
    },
    {
      address: process.env.FXPOOL_EURC_USYC || "0x28AB2A10ac0Ee3De1286BfBc41e59a7255AcF392",
      name: "EURC/USYC",
      tokenA: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC
      tokenB: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", // USYC
    },
  ];

  const FXPool = await hre.ethers.getContractFactory("FXPool");

  for (const poolInfo of pools) {
    try {
      console.log(`\n--- Checking ${poolInfo.name} Pool ---`);
      const pool = FXPool.attach(poolInfo.address);
      
      // Check if deployer is owner
      const owner = await pool.owner();
      if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`⚠ Skipping ${poolInfo.name}: Not the owner (owner: ${owner})`);
        continue;
      }
      
      // Check if the contract exists
      try {
        const poolCode = await hre.ethers.provider.getCode(poolInfo.address);
        if (poolCode === "0x") {
          console.log(`⚠ Pool ${poolInfo.name} does not exist at address ${poolInfo.address}`);
          continue;
        }
      } catch (error) {
        console.log(`⚠ Error checking pool ${poolInfo.name}: ${error.message}`);
        continue;
      }

      // Get current reserves
      const [reserveA, reserveB] = await pool.getReserves();
      const tokenA = await pool.tokenA();
      const tokenB = await pool.tokenB();
      
      // Get token decimals using standard ERC20 ABI
      const ERC20_ABI = [
        "function decimals() external view returns (uint8)",
        "function balanceOf(address owner) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)"
      ];
      const tokenAContract = await hre.ethers.getContractAt(ERC20_ABI, tokenA);
      const tokenBContract = await hre.ethers.getContractAt(ERC20_ABI, tokenB);
      const decimalsA = await tokenAContract.decimals();
      const decimalsB = await tokenBContract.decimals();
      
      const reserveAFormatted = hre.ethers.formatUnits(reserveA, decimalsA);
      const reserveBFormatted = hre.ethers.formatUnits(reserveB, decimalsB);
      
      console.log(`Current reserves:`);
      console.log(`  Token A: ${reserveAFormatted}`);
      console.log(`  Token B: ${reserveBFormatted}`);

      // Check if pool needs rebalancing (imbalance > 10%)
      if (reserveA === 0n || reserveB === 0n) {
        console.log(`⚠ Pool has zero reserves - needs initial liquidity`);
        continue;
      }

      // Calculate imbalance ratio
      const ratio = (reserveA * 10000n) / reserveB;
      const targetRatio = 10000n; // 1:1 target (50:50)
      const imbalance = ratio > targetRatio 
        ? ((ratio - targetRatio) * 100n) / targetRatio
        : ((targetRatio - ratio) * 100n) / targetRatio;

      console.log(`Current ratio: ${ratio.toString()} (target: 10000 for 50:50)`);
      console.log(`Imbalance: ${imbalance.toString()}%`);

      // Only rebalance if imbalance > 1% (more sensitive threshold)
      if (imbalance > 100n) {
        console.log(`⚠ Pool is imbalanced (${imbalance.toString()}% > 1%)`);
        console.log(`Rebalancing to 50:50 ratio...`);
        
        // Calculate which token needs to be added and how much
        let tokenToAdd, amountToAdd;
        
        if (reserveA > reserveB) {
          // ReserveA is higher, need to add tokenB
          tokenToAdd = tokenB;
          amountToAdd = reserveA - reserveB;
        } else if (reserveB > reserveA) {
          // ReserveB is higher, need to add tokenA
          tokenToAdd = tokenA;
          amountToAdd = reserveB - reserveA;
        } else {
          // Already balanced
          console.log(`✓ Pool is already balanced (50:50)`);
          continue;
        }

        const tokenDecimals = tokenToAdd.toLowerCase() === tokenA.toLowerCase() ? decimalsA : decimalsB;
        const amountFormatted = hre.ethers.formatUnits(amountToAdd, tokenDecimals);
        
        console.log(`Need to add ${amountFormatted} of ${tokenToAdd} to achieve 50:50`);

        // Check balance
        const ERC20_ABI = [
          "function decimals() external view returns (uint8)",
          "function balanceOf(address owner) external view returns (uint256)",
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) external view returns (uint256)"
        ];
        const tokenContract = await hre.ethers.getContractAt(ERC20_ABI, tokenToAdd);
        const balance = await tokenContract.balanceOf(deployer.address);
        
        if (balance < amountToAdd) {
          console.log(`⚠ Insufficient balance. Need ${amountFormatted}, have ${hre.ethers.formatUnits(balance, tokenDecimals)}`);
          continue;
        }

        // Approve token (contract will calculate exact amount needed)
        const allowance = await tokenContract.allowance(deployer.address, poolInfo.address);
        const approvalAmount = amountToAdd * 2n; // Approve 2x to be safe
        if (allowance < amountToAdd) {
          console.log(`Approving ${tokenToAdd} (${hre.ethers.formatUnits(approvalAmount, tokenDecimals)})...`);
          const approveTx = await tokenContract.approve(poolInfo.address, approvalAmount);
          await approveTx.wait();
          console.log(`✓ ${tokenToAdd} approved`);
        }

        // Use the new rebalanceTo5050 function for true 50:50 rebalancing
        console.log(`Calling rebalanceTo5050() to achieve exact 50:50 balance...`);
        try {
          const tx = await pool.rebalanceTo5050();
          console.log(`Transaction sent: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log(`✓ Rebalanced in block: ${receipt.blockNumber}`);

          // Verify the rebalancing
          const [newReserveA, newReserveB] = await pool.getReserves();
          const newReserveAFormatted = hre.ethers.formatUnits(newReserveA, decimalsA);
          const newReserveBFormatted = hre.ethers.formatUnits(newReserveB, decimalsB);
          const newRatio = newReserveB > 0n ? (newReserveA * 10000n) / newReserveB : 0n;
          const newImbalance = newRatio > targetRatio 
            ? ((newRatio - targetRatio) * 100n) / targetRatio
            : ((targetRatio - newRatio) * 100n) / targetRatio;
          
          console.log(`New reserves:`);
          console.log(`  Token A: ${newReserveAFormatted}`);
          console.log(`  Token B: ${newReserveBFormatted}`);
          console.log(`New ratio: ${newRatio.toString()} (target: 10000 for 50:50)`);
          console.log(`New imbalance: ${newImbalance.toString()}%`);
          
          if (newReserveA === newReserveB) {
            console.log(`✓ Pool is now perfectly balanced at 50:50!`);
          } else if (newImbalance <= 100n) {
            console.log(`✓ Pool is now balanced (within 1% of 50:50)`);
          } else {
            const diff = newReserveA > newReserveB ? newReserveA - newReserveB : newReserveB - newReserveA;
            const diffFormatted = newReserveA > newReserveB 
              ? hre.ethers.formatUnits(diff, decimalsA)
              : hre.ethers.formatUnits(diff, decimalsB);
            console.log(`⚠ Small difference remaining: ${diffFormatted} (may need another rebalance)`);
          }
        } catch (error) {
          // Try to get more details about the revert
          console.log(`✗ Transaction failed`);
          if (error.reason) {
            console.log(`  Revert reason: ${error.reason}`);
          }
          if (error.message) {
            console.log(`  Error message: ${error.message}`);
          }
          if (error.data) {
            console.log(`  Error data: ${JSON.stringify(error.data)}`);
          }
          throw error;
        }
      } else {
        console.log(`✓ Pool is balanced (imbalance: ${imbalance.toString()}% <= 1%)`);
      }
    } catch (error) {
      console.error(`✗ Error rebalancing ${poolInfo.name}:`, error.message);
    }
  }

  console.log("\n=== Rebalancing complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

