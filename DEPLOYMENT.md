# Deployment Guide

## Prerequisites

1. **Private Key**: You need a wallet private key to deploy contracts
2. **USDC Balance**: Arc Network uses USDC for gas fees (not ETH)
3. **Network Access**: Access to Arc Network RPC endpoint

## Setup

### 1. Create `.env` file

Create a `.env` file in the project root:

```bash
PRIVATE_KEY=your_private_key_here
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
```

**⚠️ WARNING**: Never commit your `.env` file to version control!

### 2. Get Testnet USDC

Arc Network uses USDC for gas fees. Get testnet USDC from:
- **Arc Faucet**: https://faucet.circle.com

### 3. Network Configuration

The project supports multiple networks:

- **arc**: Arc Mainnet (when available)
- **arcTestnet**: Arc Testnet (recommended for testing)
- **localhost**: Local Hardhat node
- **hardhat**: Built-in Hardhat network

## Deployment

### Deploy to Arc Testnet

```bash
npm run deploy -- --network arcTestnet
```

### Deploy to Arc Mainnet

```bash
npm run deploy -- --network arc
```

### Deploy to Local Network

First, start a local Hardhat node:

```bash
npm run node
```

Then in another terminal:

```bash
npm run deploy -- --network localhost
```

## Deployment Script

The deployment script (`scripts/deploy.js`) deploys all contracts in the correct order:

1. InterestRateModel
2. CollateralManager
3. LendingPool
4. DeliveryVsPayment
5. SettlementEngine
6. FXPool
7. StablecoinSwap
8. LiquidityAggregator
9. PaymentRouter
10. InstitutionalSettlement

## Post-Deployment

After deployment, you'll receive contract addresses. Save these for:

- Frontend integration
- Contract interactions
- Testing
- Documentation

## Troubleshooting

### Error: PRIVATE_KEY not set
- Create `.env` file with your private key
- Or export: `export PRIVATE_KEY=your_key`

### Error: Network connection failed
- Check RPC URL in `hardhat.config.js`
- Verify network is accessible
- Try testnet: `--network arcTestnet`

### Error: Insufficient balance
- Arc Network uses USDC for gas
- Get testnet USDC from faucet
- Ensure wallet has sufficient balance

### Error: Transaction reverted
- Check contract constructor parameters
- Verify all dependencies are deployed
- Review contract code for issues

## Security Notes

- **Never share your private key**
- **Use testnet for development**
- **Verify contracts before mainnet deployment**
- **Use a hardware wallet for production**

## Next Steps

After successful deployment:

1. Verify contracts on block explorer
2. Update frontend with contract addresses
3. Write integration tests
4. Set up monitoring
5. Configure access controls


