// Official Arc Network token addresses
// Source: https://docs.arc.network/arc/references/contract-addresses
// Note: USDC ERC-20 interface returns '0x' for getCode() but is still a valid ERC20 token

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logo?: string
}

export const TOKENS: Token[] = [
  {
    address: '0x3600000000000000000000000000000000000000', // USDC ERC-20 interface (uses 6 decimals)
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png?1696506694',
  },
  {
    address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', // EURC
    symbol: 'EURC',
    name: 'Euro Coin',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/26045/standard/euro.png?1696525125',
  },
  // USYC temporarily hidden - will be re-enabled when tokens and logo are available
  // {
  //   address: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C', // USYC
  //   symbol: 'USYC',
  //   name: 'USDC Yield',
  //   decimals: 6,
  // }
]

// All tokens including USYC (for internal use when needed)
export const ALL_TOKENS: Token[] = [
  ...TOKENS,
  {
    address: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C', // USYC
    symbol: 'USYC',
    name: 'USDC Yield',
    decimals: 6,
  }
]

// Token lookup by address (checks both TOKENS and ALL_TOKENS)
export const getTokenByAddress = (address: string): Token | undefined => {
  return ALL_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase())
}

// Token lookup by symbol
export const getTokenBySymbol = (symbol: string): Token | undefined => {
  return TOKENS.find(token => token.symbol.toUpperCase() === symbol.toUpperCase())
}

// Add custom token (for manual input)
export const addCustomToken = (address: string, symbol: string, name: string, decimals: number = 18): Token => {
  return {
    address,
    symbol,
    name,
    decimals,
  }
}

