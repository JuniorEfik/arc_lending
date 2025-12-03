# Arc Lending UI

A modern, beautiful web interface for interacting with the Arc Lending DeFi & Capital Markets platform.

## Features

- **Lending Protocol**: Deposit, withdraw, borrow, and manage collateral
- **FX Trading**: Swap stablecoins and add liquidity to pools
- **Capital Markets**: Create and execute DvP settlements
- **Payment System**: Create and execute cross-border payments
- **Wallet Integration**: Connect with MetaMask and other Web3 wallets
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode**: Beautiful dark theme support

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Web3 wallet (MetaMask recommended)
- Access to Arc Network

### Installation

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Configuration

The contract addresses are configured in `config/contracts.ts`. Update these if you deploy new contracts.

## Project Structure

```
frontend/
├── app/                 # Next.js app directory
│   ├── page.tsx        # Main dashboard
│   ├── layout.tsx       # Root layout
│   └── globals.css     # Global styles
├── components/          # React components
│   ├── ConnectWallet.tsx
│   ├── LendingDashboard.tsx
│   ├── FXTrading.tsx
│   ├── CapitalMarkets.tsx
│   └── Payments.tsx
├── config/              # Configuration files
│   └── contracts.ts    # Contract addresses
└── lib/                 # Utilities
    └── web3.ts          # Web3 helpers
```

## Usage

1. **Connect Wallet**: Click "Connect Wallet" and approve the connection
2. **Select Module**: Choose from Lending, FX Trading, Capital Markets, or Payments
3. **Interact**: Use the forms to interact with smart contracts
4. **Monitor**: Watch your transactions and balances update in real-time

## Features by Module

### Lending Protocol
- View deposit and borrow balances
- Deposit tokens to earn interest
- Withdraw deposited tokens
- Borrow against collateral
- Deposit collateral to increase borrowing power

### FX Trading
- View pool reserves
- Swap between stablecoin pairs
- Get real-time quotes
- Add liquidity to pools

### Capital Markets
- Create Delivery vs Payment (DvP) settlements
- Execute atomic settlements
- View settlement status

### Payment System
- Create cross-border payments
- Execute payments
- Track payment status

## Technologies

- **Next.js 14**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **ethers.js**: Web3 interactions
- **Lucide React**: Icons

## Network Configuration

The app is configured for Arc Testnet. To use a different network:

1. Update `config/contracts.ts` with your contract addresses
2. Update the RPC URL in `lib/web3.ts`
3. Ensure your wallet is connected to the correct network

## Security Notes

- Always verify contract addresses before interacting
- Test on testnet before mainnet
- Never share your private keys
- Review transaction details before confirming

## Support

For issues or questions, refer to the main project README or documentation.


