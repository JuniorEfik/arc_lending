# Contract Verification Guide - Arc Network

This guide helps you verify all deployed contracts on the Arc Network block explorer.

## Block Explorer

**Arc Testnet Explorer**: https://explorer.testnet.arc.network

## Automated Verification

Run the verification script:

```bash
npm run verify -- --network arc
```

**Note**: Arc Network's explorer may not support automated verification via Hardhat. If the script fails, use manual verification below.

## Manual Verification

If automated verification doesn't work, you can verify contracts manually on the block explorer:

### Step 1: Navigate to Contract Address

1. Go to https://explorer.testnet.arc.network
2. Search for the contract address
3. Click on the contract address

### Step 2: Verify Contract

1. Click the "Verify Contract" or "Contract" tab
2. Fill in the verification form:
   - **Contract Name**: (see list below)
   - **Compiler Version**: `0.8.20`
   - **Optimization**: Enabled (200 runs)
   - **Constructor Arguments**: (see list below)
   - **Source Code**: Copy from the contract file

### Contract Details

#### 1. InterestRateModel
- **Address**: `0xBDbbFdeefFE255a3096fa8DdE092EEb1d9ffFa2e`
- **File**: `contracts/lending/InterestRateModel.sol`
- **Constructor Args**: None

#### 2. CollateralManager
- **Address**: `0x12486F005DcAf95389d39F889A09878EB135F3fF`
- **File**: `contracts/lending/CollateralManager.sol`
- **Constructor Args**: None

#### 3. LendingPool
- **Address**: `0xF39000e8F76123fF1A838489A1f37C6c85d3d3D5`
- **File**: `contracts/lending/LendingPool.sol`
- **Constructor Args**: 
  - `0xBDbbFdeefFE255a3096fa8DdE092EEb1d9ffFa2e` (InterestRateModel)
  - `0x12486F005DcAf95389d39F889A09878EB135F3fF` (CollateralManager)

#### 4. DeliveryVsPayment
- **Address**: `0xE095e7ae70a90312ce2FeC0245301193AA9F3376`
- **File**: `contracts/capitalMarkets/DeliveryVsPayment.sol`
- **Constructor Args**: None

#### 5. SettlementEngine
- **Address**: `0x35100298873d63E8FE8dC5937DFfec8416279794`
- **File**: `contracts/capitalMarkets/SettlementEngine.sol`
- **Constructor Args**: 
  - `0xE095e7ae70a90312ce2FeC0245301193AA9F3376` (DeliveryVsPayment)

#### 6. FXPool (USDC/EURC)
- **Address**: `0x21380ab462450E0Fe1E4455ef4383D5b2A7d09a3`
- **File**: `contracts/fx/FXPool.sol`
- **Constructor Args**: 
  - `0x3600000000000000000000000000000000000000` (USDC)
  - `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (EURC)

#### 7. StablecoinSwap
- **Address**: `0x36d6b857541dBc4c41d0913452a94f669fbE3869`
- **File**: `contracts/fx/StablecoinSwap.sol`
- **Constructor Args**: None

#### 8. LiquidityAggregator
- **Address**: `0x67c034cED1D093a0568fb262c46aF38D5D76Cd66`
- **File**: `contracts/liquidity/LiquidityAggregator.sol`
- **Constructor Args**: None

#### 9. PaymentRouter
- **Address**: `0xC3a2951D2acC6Bc7e80D2173EC63a6F2760654cf`
- **File**: `contracts/payments/PaymentRouter.sol`
- **Constructor Args**: None

#### 10. InstitutionalSettlement
- **Address**: `0x0Ea4FD4ad3bB2d5FCF156Cc25A5ED53E134f20B2`
- **File**: `contracts/settlement/InstitutionalSettlement.sol`
- **Constructor Args**: 
  - Admin address (from PRIVATE_KEY - run `npm run get-admin` to get it)

## Quick Links

All contract addresses on the explorer:

- [InterestRateModel](https://explorer.testnet.arc.network/address/0xBDbbFdeefFE255a3096fa8DdE092EEb1d9ffFa2e)
- [CollateralManager](https://explorer.testnet.arc.network/address/0x12486F005DcAf95389d39F889A09878EB135F3fF)
- [LendingPool](https://explorer.testnet.arc.network/address/0xF39000e8F76123fF1A838489A1f37C6c85d3d3D5)
- [DeliveryVsPayment](https://explorer.testnet.arc.network/address/0xE095e7ae70a90312ce2FeC0245301193AA9F3376)
- [SettlementEngine](https://explorer.testnet.arc.network/address/0x35100298873d63E8FE8dC5937DFfec8416279794)
- [FXPool](https://explorer.testnet.arc.network/address/0x21380ab462450E0Fe1E4455ef4383D5b2A7d09a3)
- [StablecoinSwap](https://explorer.testnet.arc.network/address/0x36d6b857541dBc4c41d0913452a94f669fbE3869)
- [LiquidityAggregator](https://explorer.testnet.arc.network/address/0x67c034cED1D093a0568fb262c46aF38D5D76Cd66)
- [PaymentRouter](https://explorer.testnet.arc.network/address/0xC3a2951D2acC6Bc7e80D2173EC63a6F2760654cf)
- [InstitutionalSettlement](https://explorer.testnet.arc.network/address/0x0Ea4FD4ad3bB2d5FCF156Cc25A5ED53E134f20B2)

## Verification Tips

1. **Compiler Settings**: 
   - Solidity version: `0.8.20`
   - Optimization: Enabled
   - Runs: `200`

2. **Constructor Arguments**:
   - For array arguments, use ABI encoding
   - Address arguments should be in checksum format
   - Use tools like https://abi.hashex.org/ to encode constructor arguments

3. **Source Code**:
   - Include all imported contracts (OpenZeppelin contracts)
   - Some explorers support "flattened" source code
   - Use Hardhat's flatten plugin: `npx hardhat flatten contracts/YourContract.sol > flattened.sol`

4. **Troubleshooting**:
   - If verification fails, check that constructor arguments match exactly
   - Ensure compiler version and optimization settings match deployment
   - Verify all imported contracts are included

## Using Hardhat Flatten

To get flattened source code for manual verification:

```bash
npx hardhat flatten contracts/payments/PaymentRouter.sol > PaymentRouter_flattened.sol
```

Then copy the contents of the flattened file into the explorer's verification form.


