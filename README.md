# Arc Lending - DeFi & Capital Markets Platform

A comprehensive DeFi and Capital Markets platform built for Arc Network, featuring:

- **Onchain Lending Platforms**: Decentralized lending and borrowing with multiple collateral types
- **Capital Markets Solutions**: Tokenized assets, securities, and structured products
- **FX Trading**: Stablecoin foreign exchange and swap protocols
- **Payment Systems**: Cross-border payments and settlement
- **Liquidity Aggregation**: Multi-protocol liquidity aggregation
- **Institutional Trading**: Enterprise-grade trading and settlement systems

## Arc Network

Arc is an EVM-compatible Layer-1 blockchain purpose-built for programmable money and onchain innovation. Key features:
- Stablecoins as gas (USDC)
- Sub-second finality
- Enterprise-grade infrastructure
- Direct Circle integration

**Website**: https://arc.network  
**Documentation**: https://docs.arc.network/arc/concepts/welcome-to-arc

## Project Structure

```
arc-lending/
├── contracts/              # Smart contracts
│   ├── lending/
│   │   ├── LendingPool.sol
│   │   ├── InterestRateModel.sol
│   │   └── CollateralManager.sol
│   ├── capitalMarkets/
│   │   ├── TokenizedAsset.sol
│   │   ├── SettlementEngine.sol
│   │   └── DeliveryVsPayment.sol
│   ├── fx/
│   │   ├── FXPool.sol
│   │   └── StablecoinSwap.sol
│   ├── liquidity/
│   │   └── LiquidityAggregator.sol
│   ├── payments/
│   │   └── PaymentRouter.sol
│   └── settlement/
│       └── InstitutionalSettlement.sol
├── frontend/               # Next.js web interface
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── config/            # Configuration files
│   └── lib/               # Web3 utilities
├── scripts/               # Deployment scripts
└── test/                  # Test files
```

## Installation

```bash
npm install
```

## Compile

```bash
npm run compile
```

## Test

```bash
npm run test
```

## Deploy

1. Set your private key in `.env`:
```
PRIVATE_KEY=your_private_key_here
```

2. Get the admin address from your private key:
```bash
npm run get-admin
```

3. Create `frontend/.env.local` with the admin address:
```bash
# Option 1: Manual - Copy the address from get-admin output
NEXT_PUBLIC_ADMIN_ADDRESS=0x...your_admin_address_here

# Option 2: Automatic
ADMIN_ADDR=$(npm run get-admin 2>&1 | grep "Admin Address:" | awk '{print $3}') && echo "NEXT_PUBLIC_ADMIN_ADDRESS=$ADMIN_ADDR" > frontend/.env.local
```

4. Deploy to Arc:
```bash
npm run deploy -- --network arc
```

**Note**: The admin address is automatically derived from `PRIVATE_KEY` in scripts. For the frontend, it must be set in `frontend/.env.local` as `NEXT_PUBLIC_ADMIN_ADDRESS`.

## Run the UI

The project includes a modern Next.js web interface for interacting with the deployed contracts.

### Prerequisites

- Node.js 18+ and npm
- A Web3 wallet (MetaMask recommended)
- Access to Arc Network

### Setup and Run

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser:
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Connect your wallet (MetaMask or other Web3 wallet)
   - Ensure you're connected to Arc Testnet (Chain ID: 5042002)

### UI Features

The UI provides a comprehensive interface for:

- **Lending Protocol**: Deposit, withdraw, borrow, and manage collateral
- **FX Trading**: Swap stablecoins, add liquidity, view pool reserves
- **Capital Markets**: Create and execute DvP settlements
- **Payment System**: Create and execute cross-border payments

### Build for Production

```bash
cd frontend
npm run build
npm start
```

For more details, see [UI_SETUP.md](./UI_SETUP.md) and [frontend/README.md](./frontend/README.md).

## Features

### Lending Protocol
- Multi-collateral lending pools
- Dynamic interest rate models
- Automated liquidation mechanisms
- Collateral management

### Capital Markets
- Tokenized securities issuance
- Delivery vs Payment (DvP) settlement
- Real-time settlement engine
- Structured products support

### FX Trading
- Stablecoin-to-stablecoin swaps
- Automated market maker (AMM) pools
- Cross-currency trading
- Low-slippage routing

### Liquidity Aggregation
- Multi-protocol liquidity sourcing
- Optimal routing algorithms
- MEV protection
- Gas optimization

### Institutional Settlement
- Batch settlement processing
- Multi-party settlement
- Compliance and audit trails
- Enterprise-grade security

## License

MIT

