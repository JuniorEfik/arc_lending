import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES, ARC_NETWORK } from '@/config/contracts'
import {
  LENDING_POOL_ABI,
  COLLATERAL_MANAGER_ABI,
  FX_POOL_ABI,
  STABLECOIN_SWAP_ABI,
  PAYMENT_ROUTER_ABI,
  DELIVERY_VS_PAYMENT_ABI,
  SETTLEMENT_ENGINE_ABI,
  ERC20_ABI,
} from './abis'

// Check if connected to Arc Testnet
export const checkNetwork = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.ethereum) {
    return false
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const network = await provider.getNetwork()
    return Number(network.chainId) === ARC_NETWORK.chainId
  } catch (error) {
    console.error('Error checking network:', error)
    return false
  }
}

// Switch to Arc Testnet or add it if not present
export const switchToArcNetwork = async (): Promise<void> => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.')
  }

  try {
    // Try to switch to Arc Testnet
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${ARC_NETWORK.chainId.toString(16)}` }],
    })
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902 || switchError.code === -32603) {
      try {
        // Add Arc Testnet to MetaMask
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${ARC_NETWORK.chainId.toString(16)}`,
              chainName: ARC_NETWORK.name,
              nativeCurrency: {
                name: ARC_NETWORK.nativeCurrency.name,
                symbol: ARC_NETWORK.nativeCurrency.symbol,
                decimals: ARC_NETWORK.nativeCurrency.decimals,
              },
              rpcUrls: [ARC_NETWORK.rpcUrl],
              blockExplorerUrls: ['https://explorer.testnet.arc.network'],
            },
          ],
        })
      } catch (addError) {
        console.error('Error adding Arc Testnet:', addError)
        throw new Error('Failed to add Arc Testnet to your wallet. Please add it manually.')
      }
    } else {
      // Other error (e.g., user rejected)
      throw switchError
    }
  }
}

// Ensure we're on Arc Testnet before getting provider/signer
export const ensureArcNetwork = async (): Promise<void> => {
  const isOnArc = await checkNetwork()
  if (!isOnArc) {
    await switchToArcNetwork()
    // Wait a bit for the network switch to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Verify we're on the correct network
    const verified = await checkNetwork()
    if (!verified) {
      throw new Error('Failed to switch to Arc Testnet. Please switch manually in your wallet.')
    }
  }
}

export const getProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum)
  }
  return new ethers.JsonRpcProvider(ARC_NETWORK.rpcUrl)
}

export const getSigner = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    // Ensure we're on Arc Testnet before getting signer
    await ensureArcNetwork()
    const provider = new ethers.BrowserProvider(window.ethereum)
    return await provider.getSigner()
  }
  throw new Error('No wallet connected')
}

// Contract instances
export const getLendingPool = async () => {
  const signer = await getSigner()
  return new ethers.Contract(CONTRACT_ADDRESSES.lendingPool, LENDING_POOL_ABI, signer)
}

export const getCollateralManager = async () => {
  const signer = await getSigner()
  return new ethers.Contract(CONTRACT_ADDRESSES.collateralManager, COLLATERAL_MANAGER_ABI, signer)
}

export const getFXPool = async (poolAddress?: string) => {
  const signer = await getSigner()
  const address = poolAddress || CONTRACT_ADDRESSES.fxPool
  return new ethers.Contract(address, FX_POOL_ABI, signer)
}

export const getStablecoinSwap = async () => {
  const signer = await getSigner()
  return new ethers.Contract(CONTRACT_ADDRESSES.stablecoinSwap, STABLECOIN_SWAP_ABI, signer)
}

export const getPaymentRouter = async () => {
  const signer = await getSigner()
  return new ethers.Contract(CONTRACT_ADDRESSES.paymentRouter, PAYMENT_ROUTER_ABI, signer)
}

export const getDeliveryVsPayment = async () => {
  const signer = await getSigner()
  return new ethers.Contract(CONTRACT_ADDRESSES.deliveryVsPayment, DELIVERY_VS_PAYMENT_ABI, signer)
}

export const getSettlementEngine = async () => {
  const signer = await getSigner()
  return new ethers.Contract(CONTRACT_ADDRESSES.settlementEngine, SETTLEMENT_ENGINE_ABI, signer)
}

export const getERC20 = (address: string) => {
  const provider = getProvider()
  return new ethers.Contract(address, ERC20_ABI, provider)
}

export const getERC20WithSigner = async (address: string) => {
  const signer = await getSigner()
  return new ethers.Contract(address, ERC20_ABI, signer)
}

// Validate token address and contract
export const validateTokenAddress = async (address: string): Promise<boolean> => {
  if (!ethers.isAddress(address)) {
    return false
  }
  
  try {
    const provider = getProvider()
    const code = await provider.getCode(address)
    // Some contracts might return '0x' for proxy contracts or special addresses
    // USDC on Arc uses a special address, so we'll also try to call a function
    if (code === '0x' || code === '0x0') {
      // For special addresses like USDC ERC-20 interface, try to call decimals()
      try {
        const token = getERC20(address)
        await token.decimals()
        return true
      } catch {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

// Get token info safely
export const getTokenInfo = async (address: string) => {
  const token = getERC20(address)
  
  // Special handling for USDC ERC-20 interface
  const isUSDC = address.toLowerCase() === '0x3600000000000000000000000000000000000000'
  
  // Try to get decimals first (most important and usually works)
  // This is the critical validation - if decimals() works, token is ERC20 compatible
  let decimals = isUSDC ? 6 : 18 // USDC uses 6 decimals
  let decimalsSuccess = false
  
  try {
    const decimalsResult = await token.decimals()
    decimals = Number(decimalsResult)
    decimalsSuccess = true
    console.log('Token decimals fetched:', decimals)
  } catch (error: any) {
    console.warn('decimals() failed, using default or fallback:', error.message)
    // If decimals fails, try balanceOf as a fallback validation
    try {
      const testAddress = '0x0000000000000000000000000000000000000000'
      await token.balanceOf(testAddress)
      // If balanceOf works, token exists but decimals() might not be available
      // Use known decimals for USDC, otherwise default to 18
      if (!isUSDC) {
        decimals = 18
      }
      decimalsSuccess = true
    } catch (balanceError: any) {
      console.error('Both decimals() and balanceOf() failed')
      // Both failed - token is invalid
      throw new Error(`Token does not support decimals() or balanceOf() - invalid ERC20. Error: ${error.message || balanceError.message}`)
    }
  }
  
  // Try to get symbol and name (may not work for all tokens like USDC ERC-20 interface)
  // These are optional - if they fail, we still consider the token valid
  let symbol = 'UNKNOWN'
  let name = 'Unknown Token'
  
  // Use known values for USDC if we can't fetch them
  if (isUSDC) {
    symbol = 'USDC'
    name = 'USD Coin'
  }
  
  try {
    const symbolResult = await token.symbol()
    if (symbolResult && symbolResult.length > 0 && symbolResult !== '0x') {
      symbol = symbolResult
    }
  } catch (error: any) {
    console.warn('symbol() failed:', error.message)
    // Symbol might not be available, that's okay for USDC ERC-20 interface
  }
  
  try {
    const nameResult = await token.name()
    if (nameResult && nameResult.length > 0 && nameResult !== '0x') {
      name = nameResult
    }
  } catch (error: any) {
    console.warn('name() failed:', error.message)
    // Name might not be available, that's okay for USDC ERC-20 interface
  }
  
  // If we got decimals (or balanceOf worked), the token is valid even if symbol/name failed
  return { symbol, name, decimals }
}

