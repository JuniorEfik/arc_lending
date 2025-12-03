// Contract addresses deployed on Arc Network
// Updated with latest deployment addresses
export const CONTRACT_ADDRESSES = {
  // Lending Protocol
  interestRateModel: '0xBDbbFdeefFE255a3096fa8DdE092EEb1d9ffFa2e',
  collateralManager: '0x12486F005DcAf95389d39F889A09878EB135F3fF',
  lendingPool: '0xF39000e8F76123fF1A838489A1f37C6c85d3d3D5',
  
  // Capital Markets
  deliveryVsPayment: '0xE095e7ae70a90312ce2FeC0245301193AA9F3376',
  settlementEngine: '0x35100298873d63E8FE8dC5937DFfec8416279794',
  
  // FX Trading
  fxPool: '0x8C16EfD6d477D2BA48eba504a870Bb1f4fe59082', // USDC/EURC (default)
  fxPools: {
    usdcEurc: '0x8C16EfD6d477D2BA48eba504a870Bb1f4fe59082', // USDC/EURC
    usdcUsyc: '0x1fCf906eD8Ce3220c325404c33F0ed169012beEe', // USDC/USYC
    eurcUsyc: '0x28AB2A10ac0Ee3De1286BfBc41e59a7255AcF392', // EURC/USYC
  },
  stablecoinSwap: '0x36d6b857541dBc4c41d0913452a94f669fbE3869',
  
  // Liquidity & Payments
  liquidityAggregator: '0x67c034cED1D093a0568fb262c46aF38D5D76Cd66',
  paymentRouter: '0xC3a2951D2acC6Bc7e80D2173EC63a6F2760654cf',
  
  // Institutional
  institutionalSettlement: '0x0Ea4FD4ad3bB2d5FCF156Cc25A5ED53E134f20B2',
} as const

// Arc Network configuration
export const ARC_NETWORK = {
  chainId: 5042002,
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.network',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6, // USDC uses 6 decimals on Arc Network
  },
  blockExplorerUrl: 'https://explorer.testnet.arc.network',
} as const

// Admin address - derived from PRIVATE_KEY in .env
// For frontend: Set NEXT_PUBLIC_ADMIN_ADDRESS in frontend/.env.local
// For scripts: Derived automatically from PRIVATE_KEY
// Run: npm run get-admin to get the address from your PRIVATE_KEY
export const ADMIN_ADDRESS: string = process.env.NEXT_PUBLIC_ADMIN_ADDRESS || ''

if (!ADMIN_ADDRESS && typeof window !== 'undefined') {
  console.warn('⚠️ NEXT_PUBLIC_ADMIN_ADDRESS is not set in environment variables. Admin features will not work.')
  console.warn('   Run: npm run get-admin to get the address, then add it to frontend/.env.local')
}

