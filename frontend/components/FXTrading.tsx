'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftRight, Plus, Minus, AlertCircle, ArrowDown, Circle, ChevronDown, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { getFXPool, getStablecoinSwap, getERC20WithSigner, getERC20, getTokenInfo } from '@/lib/web3'
import { TokenSelector } from './TokenSelector'
import { TokenInfo } from './TokenInfo'
import { ADMIN_ADDRESS } from '@/config/contracts'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { getTokenByAddress } from '@/config/tokens'
import { ethers } from 'ethers'
import { useToast } from '@/contexts/ToastContext'

interface FXTradingProps {
  account: string
}

declare global {
  interface Window {
    ethereum?: any
  }
}

export function FXTrading({ account }: FXTradingProps) {
  const { showSuccess, showError, showWarning, showInfo } = useToast()
  const [swapAmount, setSwapAmount] = useState('')
  const [tokenIn, setTokenIn] = useState('')
  const [tokenOut, setTokenOut] = useState('')
  const [quote, setQuote] = useState('0')
  const [liquidityTokenA, setLiquidityTokenA] = useState('')
  const [liquidityTokenB, setLiquidityTokenB] = useState('')
  const [liquidityAmountA, setLiquidityAmountA] = useState('')
  const [liquidityAmountB, setLiquidityAmountB] = useState('')
  const [userLiquidityA, setUserLiquidityA] = useState('0')
  const [userLiquidityB, setUserLiquidityB] = useState('0')
  const [removeLiquidityAmount, setRemoveLiquidityAmount] = useState('')
  const [reserves, setReserves] = useState<[string, string]>(['0', '0'])
  const [poolTokenAddresses, setPoolTokenAddresses] = useState<[string, string]>(['', ''])
  const [selectedPool, setSelectedPool] = useState<string>(CONTRACT_ADDRESSES.fxPools.usdcEurc)
  const [isLoadingSwap, setIsLoadingSwap] = useState(false)
  const [isLoadingAddLiquidity, setIsLoadingAddLiquidity] = useState(false)
  const [isLoadingRemoveLiquidity, setIsLoadingRemoveLiquidity] = useState(false)
  const [isLoadingRegisterPool, setIsLoadingRegisterPool] = useState(false)
  const [isLoadingRebalance, setIsLoadingRebalance] = useState(false)
  const [isLoadingWithdrawAll, setIsLoadingWithdrawAll] = useState(false)
  const [showTokenInSelector, setShowTokenInSelector] = useState(false)
  const [showTokenOutSelector, setShowTokenOutSelector] = useState(false)
  const [tokenInInfo, setTokenInInfo] = useState<{ symbol: string; name: string; decimals: number; logo?: string } | null>(null)
  const [tokenOutInfo, setTokenOutInfo] = useState<{ symbol: string; name: string; decimals: number; logo?: string } | null>(null)
  const [activeMode, setActiveMode] = useState<'swap' | 'liquidity'>('swap')
  
  // Admin state
  const [isOwner, setIsOwner] = useState(false)
  const [poolTokenA, setPoolTokenA] = useState('')
  const [poolTokenB, setPoolTokenB] = useState('')
  
  
  // Admin state for withdrawing all liquidity
  const [withdrawRecipient, setWithdrawRecipient] = useState('')

  const checkOwner = () => {
    if (!account) {
      setIsOwner(false)
      return
    }
    setIsOwner(account.toLowerCase() === ADMIN_ADDRESS.toLowerCase())
  }
  
  useEffect(() => {
    loadReserves()
    checkOwner()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  useEffect(() => {
    loadReserves()
    // Auto-set token A and B when pool is selected
    const loadPoolTokens = async () => {
      if (selectedPool && ethers.isAddress(selectedPool)) {
        try {
          const fxPool = await getFXPool(selectedPool)
          const poolTokenA = await fxPool.tokenA()
          const poolTokenB = await fxPool.tokenB()
          setPoolTokenAddresses([poolTokenA, poolTokenB])
          // Auto-set liquidity tokens to match the pool
          setLiquidityTokenA(poolTokenA)
          setLiquidityTokenB(poolTokenB)
          // Load user's liquidity for this pool
          if (account) {
            await loadUserLiquidity()
          }
        } catch (error) {
          console.error('Error loading pool tokens:', error)
        }
      }
    }
    loadPoolTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPool, account])
  
  // Auto-refresh user liquidity periodically
  useEffect(() => {
    if (!account || !selectedPool) return
    
    const interval = setInterval(() => {
      loadUserLiquidity()
    }, 10000) // Refresh every 10 seconds
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, selectedPool])
  
  const loadUserLiquidity = async (forceRefresh = false) => {
    if (!account || !selectedPool) {
      setUserLiquidityA('0')
      setUserLiquidityB('0')
      return
    }
    try {
      // Create a completely fresh contract instance with a fresh provider to bypass any caching
      const { getProvider } = await import('@/lib/web3')
      const { FX_POOL_ABI } = await import('@/lib/abis')
      const provider = getProvider()
      
      // Force a block number query to ensure fresh state
      await provider.getBlockNumber()
      
      // Create a fresh contract instance directly (not through getFXPool to avoid any caching)
      // Use provider instead of signer for read operations to avoid any signer caching
      const fxPoolReadOnly = new ethers.Contract(selectedPool, FX_POOL_ABI, provider)
      
      // Call getUserLiquidity directly on the fresh instance
      const [userAmountA, userAmountB] = await fxPoolReadOnly.getUserLiquidity(account)
      
      // Get token decimals for formatting - use the same fresh instance
      const poolTokenA = await fxPoolReadOnly.tokenA()
      const poolTokenB = await fxPoolReadOnly.tokenB()
      let tokenADecimals = 18
      let tokenBDecimals = 18
      try {
        const tokenAContract = getERC20(poolTokenA)
        const tokenBContract = getERC20(poolTokenB)
        const decimalsA = await tokenAContract.decimals()
        const decimalsB = await tokenBContract.decimals()
        tokenADecimals = typeof decimalsA === 'bigint' ? Number(decimalsA) : decimalsA
        tokenBDecimals = typeof decimalsB === 'bigint' ? Number(decimalsB) : decimalsB
      } catch {
        // Default to 18
      }
      
      const formattedA = ethers.formatUnits(userAmountA, tokenADecimals)
      const formattedB = ethers.formatUnits(userAmountB, tokenBDecimals)
      
      // Force state update - use both direct and functional setState
      setUserLiquidityA(formattedA)
      setUserLiquidityB(formattedB)
      
      // Also use functional setState to ensure React sees the change
      setTimeout(() => {
        setUserLiquidityA((prev) => {
          if (prev !== formattedA) {
            return formattedA
          }
          return prev
        })
        setUserLiquidityB((prev) => {
          if (prev !== formattedB) {
            return formattedB
          }
          return prev
        })
      }, 100)
    } catch (error) {
      console.error('Error loading user liquidity:', error)
      setUserLiquidityA('0')
      setUserLiquidityB('0')
    }
  }
  
  useEffect(() => {
    checkOwner()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])
  

  useEffect(() => {
    if (swapAmount && tokenIn && tokenOut) {
      getSwapQuote()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapAmount, tokenIn, tokenOut])

  // Load token info when tokenIn changes
  useEffect(() => {
    const loadTokenInInfo = async () => {
      if (!tokenIn || !ethers.isAddress(tokenIn)) {
        setTokenInInfo(null)
        return
      }
      try {
        const info = await getTokenInfo(tokenIn)
        const tokenConfig = getTokenByAddress(tokenIn)
        setTokenInInfo({
          ...info,
          logo: tokenConfig?.logo
        })
      } catch (error) {
        console.error('Error loading tokenIn info:', error)
        setTokenInInfo(null)
      }
    }
    loadTokenInInfo()
  }, [tokenIn])

  // Load token info when tokenOut changes
  useEffect(() => {
    const loadTokenOutInfo = async () => {
      if (!tokenOut || !ethers.isAddress(tokenOut)) {
        setTokenOutInfo(null)
        return
      }
      try {
        const info = await getTokenInfo(tokenOut)
        const tokenConfig = getTokenByAddress(tokenOut)
        setTokenOutInfo({
          ...info,
          logo: tokenConfig?.logo
        })
      } catch (error) {
        console.error('Error loading tokenOut info:', error)
        setTokenOutInfo(null)
      }
    }
    loadTokenOutInfo()
  }, [tokenOut])

  // Auto-switch when same token is selected on both sides
  useEffect(() => {
    const autoSwitchToken = async () => {
      // Skip if either token is empty
      if (!tokenIn || !tokenOut || !ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
        return
      }

      // Check if tokens are the same (case-insensitive)
      if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
        try {
          let newTokenOut = ''
          
          // Try to get the other token from the selected pool
          if (selectedPool && ethers.isAddress(selectedPool)) {
            const fxPool = await getFXPool(selectedPool)
            const poolTokenA = await fxPool.tokenA()
            const poolTokenB = await fxPool.tokenB()
            
            // If the selected token matches poolTokenA, switch to poolTokenB
            if (tokenIn.toLowerCase() === poolTokenA.toLowerCase()) {
              newTokenOut = poolTokenB
            }
            // If the selected token matches poolTokenB, switch to poolTokenA
            else if (tokenIn.toLowerCase() === poolTokenB.toLowerCase()) {
              newTokenOut = poolTokenA
            }
          }
          
          // If not in pool or pool doesn't have the token, switch to a different token from TOKENS list
          if (!newTokenOut) {
            const { TOKENS } = await import('@/config/tokens')
            const otherToken = TOKENS.find(token => 
              token.address.toLowerCase() !== tokenIn.toLowerCase()
            )
            
            if (otherToken) {
              newTokenOut = otherToken.address
            }
          }
          
          // Only update if we found a different token
          if (newTokenOut && newTokenOut.toLowerCase() !== tokenOut.toLowerCase()) {
            setTokenOut(newTokenOut)
          }
        } catch (error) {
          console.error('Error auto-switching token:', error)
        }
      }
    }
    
    autoSwitchToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIn, tokenOut, selectedPool])

  const loadReserves = async () => {
    try {
      const fxPool = await getFXPool(selectedPool)
      const [reserveA, reserveB] = await fxPool.getReserves()
      
      // Get pool's token addresses
      const poolTokenA = await fxPool.tokenA()
      const poolTokenB = await fxPool.tokenB()
      setPoolTokenAddresses([poolTokenA, poolTokenB])
      
      // Check if pool has valid tokens
      if (poolTokenA === ethers.ZeroAddress || poolTokenB === ethers.ZeroAddress) {
        setReserves(['0', '0'])
        return // Don't try to format with invalid addresses
      }
      
      // Get token decimals for proper formatting
      let tokenADecimals = 18
      let tokenBDecimals = 18
      try {
        const tokenAContract = getERC20(poolTokenA)
        const tokenBContract = getERC20(poolTokenB)
        tokenADecimals = await tokenAContract.decimals()
        tokenBDecimals = await tokenBContract.decimals()
      } catch {
        // Default to 18
      }
      
      setReserves([
        ethers.formatUnits(reserveA, tokenADecimals),
        ethers.formatUnits(reserveB, tokenBDecimals)
      ])
    } catch (error) {
      console.error('Error loading reserves:', error)
    }
  }

  const getSwapQuote = async () => {
    if (!swapAmount || !tokenIn || !tokenOut) {
      setQuote('0')
      return
    }
    
    // Validate swap amount
    const amount = parseFloat(swapAmount)
    if (isNaN(amount) || amount <= 0) {
      setQuote('0')
      return
    }
    
    try {
      const stablecoinSwap = await getStablecoinSwap()
      
      // Try to get pool from StablecoinSwap first
      let poolAddress = await stablecoinSwap.pools(tokenIn, tokenOut)
      let useRegisteredPool = poolAddress !== ethers.ZeroAddress
      
      // If not registered, check if selected pool matches the token pair
      if (!useRegisteredPool) {
        try {
          const selectedPoolContract = await getFXPool(selectedPool)
          const poolTokenA = await selectedPoolContract.tokenA()
          const poolTokenB = await selectedPoolContract.tokenB()
          
          const tokenInLower = tokenIn.toLowerCase()
          const tokenOutLower = tokenOut.toLowerCase()
          const poolTokenALower = poolTokenA.toLowerCase()
          const poolTokenBLower = poolTokenB.toLowerCase()
          
          const matchesPool = (tokenInLower === poolTokenALower && tokenOutLower === poolTokenBLower) ||
                             (tokenInLower === poolTokenBLower && tokenOutLower === poolTokenALower)
          
          if (matchesPool) {
            poolAddress = selectedPool
            useRegisteredPool = false
          } else {
            setQuote('0')
            return
          }
        } catch {
          setQuote('0')
          return
        }
      }
      
      // Get token decimals
      let tokenInDecimals = 18
      let tokenOutDecimals = 18
      try {
        const tokenInContract = getERC20(tokenIn)
        const decimals = await tokenInContract.decimals()
        tokenInDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
      } catch {
        // Default to 18
      }
      try {
        const tokenOutContract = getERC20(tokenOut)
        const decimals = await tokenOutContract.decimals()
        tokenOutDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
      } catch {
        // Default to 18
      }
      
      const amountIn = ethers.parseUnits(swapAmount, tokenInDecimals)
      
      // Validate amountIn is greater than 0
      if (amountIn === 0n) {
        setQuote('0')
        return
      }
      
      // Check pool reserves before getting quote
      const fxPool = await getFXPool(poolAddress)
      const [reserveA, reserveB] = await fxPool.getReserves()
      if (reserveA === 0n || reserveB === 0n) {
        setQuote('0')
        return
      }
      
      // Get quote - use StablecoinSwap if registered, otherwise calculate directly
      let quoteAmount: bigint
      if (useRegisteredPool) {
        quoteAmount = await stablecoinSwap.getQuote(tokenIn, tokenOut, amountIn)
      } else {
        // Calculate quote directly from pool
        const poolTokenA = await fxPool.tokenA()
        if (tokenIn.toLowerCase() === poolTokenA.toLowerCase()) {
          quoteAmount = await fxPool.getAmountOut(amountIn, reserveA, reserveB)
        } else {
          quoteAmount = await fxPool.getAmountOut(amountIn, reserveB, reserveA)
        }
      }
      
      setQuote(ethers.formatUnits(quoteAmount, tokenOutDecimals))
    } catch (error: any) {
      console.error('Error getting quote:', error)
      setQuote('0')
    }
  }

  const handleSwap = async () => {
    if (!swapAmount || !tokenIn || !tokenOut) {
      showWarning('Please enter an amount and select both tokens')
      return
    }
    
    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
      showError('Invalid token addresses')
      return
    }
    
    setIsLoadingSwap(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      // Get token decimals FIRST - needed for all calculations
      let tokenInDecimals = 18
      let tokenOutDecimals = 18
      try {
        const tokenInContract = getERC20(tokenIn)
        const decimals = await tokenInContract.decimals()
        tokenInDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
      } catch {
        // Default to 18
      }
      try {
        const tokenOutContract = getERC20(tokenOut)
        const decimals = await tokenOutContract.decimals()
        tokenOutDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
      } catch {
        // Default to 18
      }
      
      // Validate swap amount
      const amount = parseFloat(swapAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount greater than 0')
      }
      
      const amountIn = ethers.parseUnits(swapAmount, tokenInDecimals)
      
      // Validate amountIn is greater than 0
      if (amountIn === 0n) {
        throw new Error('Invalid swap amount. Please enter a valid amount.')
      }
      
      // IMPORTANT: Do ALL validation BEFORE any approvals or transactions
      const stablecoinSwap = await getStablecoinSwap()
      
      // First, check if selected pool matches the token pair
      // This ensures we use the pool the user selected, not necessarily what's registered
      const selectedPoolContract = await getFXPool(selectedPool)
      const selectedPoolTokenA = await selectedPoolContract.tokenA()
      const selectedPoolTokenB = await selectedPoolContract.tokenB()
      
      const tokenInLower = tokenIn.toLowerCase()
      const tokenOutLower = tokenOut.toLowerCase()
      const selectedPoolTokenALower = selectedPoolTokenA.toLowerCase()
      const selectedPoolTokenBLower = selectedPoolTokenB.toLowerCase()
      
      const matchesSelectedPool = (tokenInLower === selectedPoolTokenALower && tokenOutLower === selectedPoolTokenBLower) ||
                                 (tokenInLower === selectedPoolTokenBLower && tokenOutLower === selectedPoolTokenALower)
      
      let poolAddress: string
      let useRegisteredPool: boolean
      
      if (matchesSelectedPool) {
        // Use the selected pool - this is what the user expects
        poolAddress = selectedPool
        useRegisteredPool = false
      } else {
        // Check if pool is registered in StablecoinSwap
        poolAddress = await stablecoinSwap.pools(tokenIn, tokenOut)
        useRegisteredPool = poolAddress !== ethers.ZeroAddress
        
        if (!useRegisteredPool) {
          throw new Error('Pool not found. The selected pool does not match the token pair, and no registered pool found. Please select the correct pool or contact admin to register it.')
        }
      }
      
      // Get pool for swap - use fresh provider for reading, signer for transactions
      const { getProvider, getSigner } = await import('@/lib/web3')
      const { FX_POOL_ABI } = await import('@/lib/abis')
      const provider = getProvider()
      
      // Force a fresh block query to ensure we get latest state
      await provider.getBlockNumber()
      
      // Create a fresh read-only contract instance to check reserves (bypass caching)
      const readOnlyPool = new ethers.Contract(poolAddress, FX_POOL_ABI, provider)
      
      const token = await getERC20WithSigner(tokenIn)
      
      // Recalculate expected output right before swap to ensure accuracy
      // Use fresh contract instance to avoid caching
      const [reserveA, reserveB] = await readOnlyPool.getReserves()
      
      // Get token info for formatting
      const finalPoolTokenA = await readOnlyPool.tokenA()
      const finalPoolTokenB = await readOnlyPool.tokenB()
      
      let tokenADecimals = 18
      let tokenBDecimals = 18
      try {
        const tokenAContract = getERC20(finalPoolTokenA)
        const tokenBContract = getERC20(finalPoolTokenB)
        const decimalsA = await tokenAContract.decimals()
        const decimalsB = await tokenBContract.decimals()
        tokenADecimals = typeof decimalsA === 'bigint' ? Number(decimalsA) : decimalsA
        tokenBDecimals = typeof decimalsB === 'bigint' ? Number(decimalsB) : decimalsB
      } catch (err) {
        // Use default decimals if fetch fails
      }
      
      const reserveAFormatted = ethers.formatUnits(reserveA, tokenADecimals)
      const reserveBFormatted = ethers.formatUnits(reserveB, tokenBDecimals)
      
      // Check if pool has liquidity
      if (reserveA === 0n || reserveB === 0n) {
        throw new Error(`Pool has no liquidity. Current reserves: ${reserveAFormatted} / ${reserveBFormatted} tokens. Pool address: ${poolAddress}. Please add liquidity to the pool first.`)
      }
      
      let expectedAmountOut: bigint
      if (tokenIn.toLowerCase() === finalPoolTokenA.toLowerCase()) {
        expectedAmountOut = await readOnlyPool.getAmountOut(amountIn, reserveA, reserveB)
      } else {
        expectedAmountOut = await readOnlyPool.getAmountOut(amountIn, reserveB, reserveA)
      }
      
      // Calculate minAmountOut with 1% slippage tolerance
      const minAmountOut = (expectedAmountOut * 99n) / 100n
      
      // Create a contract instance with signer for transactions
      const signer = await getSigner()
      const finalPool = new ethers.Contract(poolAddress, FX_POOL_ABI, signer)
      
      // If pool is not registered, we need to swap directly through the pool
      if (!useRegisteredPool) {
        // Swap directly through the pool (bypass StablecoinSwap)
        // Check allowance for direct pool swap
        const allowance = await token.allowance(account, poolAddress)
        if (allowance < amountIn) {
          const approveTx = await token.approve(poolAddress, amountIn)
          await approveTx.wait()
        }
        
        const tx = await finalPool.swap(tokenIn, amountIn)
        await tx.wait()
        showSuccess('Swap successful!')
        setSwapAmount('')
        loadReserves()
        return
      }
      
      // Swap through StablecoinSwap (pool is registered)
      // Check allowance
      const allowance = await token.allowance(account, await stablecoinSwap.getAddress())
      if (allowance < amountIn) {
        const approveTx = await token.approve(await stablecoinSwap.getAddress(), amountIn)
        await approveTx.wait()
      }
      const tx = await stablecoinSwap.swapDirect(tokenIn, tokenOut, amountIn, minAmountOut)
      await tx.wait()
      showSuccess('Swap successful!')
      setSwapAmount('')
      loadReserves()
    } catch (error: any) {
      let errorMessage = error.reason || error.message || 'Swap failed'
      
      // Log full error for debugging
      console.error('Swap error details:', {
        message: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data,
        swapAmount,
        tokenIn,
        tokenOut
      })
      
      // Try to get pool reserves for better error messages
      // Need to determine poolAddress again since it's not in catch scope
      let errorPoolAddress: string | null = null
      try {
        const stablecoinSwap = await getStablecoinSwap()
        errorPoolAddress = await stablecoinSwap.pools(tokenIn, tokenOut)
        if (errorPoolAddress === ethers.ZeroAddress) {
          errorPoolAddress = selectedPool
        }
      } catch {}
      
      try {
        if (!errorPoolAddress) {
          errorPoolAddress = selectedPool
        }
        const finalPool = await getFXPool(errorPoolAddress)
        const [reserveA, reserveB] = await finalPool.getReserves()
        const poolTokenA = await finalPool.tokenA()
        const isTokenA = tokenIn.toLowerCase() === poolTokenA.toLowerCase()
        const reserveOut = isTokenA ? reserveB : reserveA
        
        // Get token decimals for formatting
        let tokenOutDecimals = 18
        try {
          const tokenOutContract = getERC20(tokenOut)
          const decimals = await tokenOutContract.decimals()
          tokenOutDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
        } catch {}
        
        const reserveOutFormatted = ethers.formatUnits(reserveOut, tokenOutDecimals)
        
        // Check for specific error types and provide detailed messages
        if (
          error.message?.includes('less than 1.5 tokens would remain') ||
          error.reason?.includes('less than 1.5 tokens would remain')
        ) {
          const minReserveThreshold = 15n * 10n ** (BigInt(tokenOutDecimals) - 1n)
          const maxOutputAllowed = reserveOut - minReserveThreshold
          const maxOutputFormatted = ethers.formatUnits(maxOutputAllowed, tokenOutDecimals)
          errorMessage = `Insufficient liquidity: This swap would leave less than 1.5 tokens in the pool.\n\nCurrent ${tokenOutInfo?.symbol || 'output token'} reserve: ${reserveOutFormatted} tokens\nMaximum output allowed: ${maxOutputFormatted} tokens\n\nPlease try a smaller swap amount.`
        } else if (
          error.message?.includes('poor exchange rate') ||
          error.reason?.includes('poor exchange rate')
        ) {
          errorMessage = `Insufficient liquidity: Exchange rate too poor. The output would be less than 40% of the input value.\n\nCurrent ${tokenOutInfo?.symbol || 'output token'} reserve: ${reserveOutFormatted} tokens\n\nPlease try a smaller swap amount.`
        } else if (
          error.message?.includes('output exceeds available reserve') ||
          error.reason?.includes('output exceeds available reserve')
        ) {
          errorMessage = `Insufficient liquidity: Requested output exceeds available reserve.\n\nCurrent ${tokenOutInfo?.symbol || 'output token'} reserve: ${reserveOutFormatted} tokens\n\nPlease try a smaller swap amount.`
        } else if (
          error.message?.includes('zero output') ||
          error.reason?.includes('zero output')
        ) {
          errorMessage = `Insufficient liquidity: Swap would result in zero output.\n\nCurrent ${tokenOutInfo?.symbol || 'output token'} reserve: ${reserveOutFormatted} tokens\n\nPlease try a smaller swap amount.`
        } else if (
          error.message?.includes('Not more than 2 tokens can be swapped') ||
          error.reason?.includes('Not more than 2 tokens can be swapped')
        ) {
          errorMessage = 'Maximum swap amount is 2 tokens. Please reduce your swap amount.'
        } else if (
          error.message?.includes('Pool has no liquidity') ||
          error.reason?.includes('Pool has no liquidity')
        ) {
          errorMessage = `Pool has no liquidity.\n\nCurrent reserves: ${ethers.formatUnits(reserveA, tokenOutDecimals)} / ${ethers.formatUnits(reserveB, tokenOutDecimals)} tokens\n\nPlease add liquidity to the pool first.`
        } else if (
          error.message?.includes('Insufficient liquidity') ||
          error.reason?.includes('Insufficient liquidity')
        ) {
          errorMessage = `Insufficient liquidity.\n\nCurrent ${tokenOutInfo?.symbol || 'output token'} reserve: ${reserveOutFormatted} tokens\nSwap amount: ${swapAmount} ${tokenInInfo?.symbol || 'tokens'}\n\nPlease try a smaller swap amount.`
        } else if (error.message?.includes('Pool not found')) {
          errorMessage = 'Pool not found. The pool for this token pair needs to be registered first. Contact the admin.'
        } else if (error.message?.includes('Invalid input') || error.message?.includes('Invalid swap amount') || error.message?.includes('valid amount')) {
          errorMessage = 'Invalid swap amount. Please enter a valid amount greater than 0.'
        } else if (error.message?.includes('user rejected') || error.code === 4001) {
          errorMessage = 'Transaction was rejected'
        } else if (error.message?.includes('Slippage')) {
          errorMessage = 'Slippage exceeded. Try again with a lower amount or adjust slippage tolerance.'
        }
      } catch (debugError) {
        console.error('Error getting pool info for error message:', debugError)
        // Fall back to basic error message
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingSwap(false)
    }
  }

  const handleRemoveLiquidity = async () => {
    if (!removeLiquidityAmount) {
      showWarning('Please enter amount to remove')
      return
    }
    
    if (!account) {
      showWarning('Please connect your wallet')
      return
    }
    
    setIsLoadingRemoveLiquidity(true)
    try {
      // Ensure we're on Arc Testnet
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const fxPool = await getFXPool(selectedPool)
      const poolTokenA = await fxPool.tokenA()
      const poolTokenB = await fxPool.tokenB()
      
      // Get token decimals (use the smaller decimal for consistency, or tokenA's decimals)
      let tokenADecimals = 18
      let tokenBDecimals = 18
      try {
        const tokenAContract = getERC20(poolTokenA)
        const tokenBContract = getERC20(poolTokenB)
        const decimalsA = await tokenAContract.decimals()
        const decimalsB = await tokenBContract.decimals()
        tokenADecimals = typeof decimalsA === 'bigint' ? Number(decimalsA) : decimalsA
        tokenBDecimals = typeof decimalsB === 'bigint' ? Number(decimalsB) : decimalsB
      } catch {
        // Default to 18
      }
      
      // Use tokenA decimals for parsing (both should be the same for stablecoins, but use tokenA as reference)
      const decimals = tokenADecimals
      
      // Validate amount doesn't exceed user's liquidity (check both tokens)
      const userAmountA = parseFloat(userLiquidityA)
      const userAmountB = parseFloat(userLiquidityB)
      const removeAmount = parseFloat(removeLiquidityAmount)
      
      // User must have sufficient liquidity in both tokens (1:1 ratio)
      const maxRemovable = Math.min(userAmountA, userAmountB)
      if (removeAmount > maxRemovable) {
        throw new Error(`Cannot remove more than ${maxRemovable} (limited by available liquidity in both tokens)`)
      }
      
      // Parse amount (will be used for both tokens in 1:1 ratio)
      const amount = ethers.parseUnits(removeLiquidityAmount, decimals)
      
      // Remove liquidity (single amount, removes from both tokens in 1:1 ratio)
      const tx = await fxPool.removeLiquidity(amount)
      const receipt = await tx.wait()
      
      showSuccess('Liquidity removed successfully!')
      setRemoveLiquidityAmount('')
      
      // Immediately reset state to show 0 (optimistic update)
      setUserLiquidityA('0')
      setUserLiquidityB('0')
      
      // Wait for transaction to be confirmed and blockchain state to update
      // Use longer delay to ensure RPC node has updated state
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Force refresh - reload reserves and user liquidity multiple times to ensure update
      await loadReserves()
      
      // Try loading user liquidity multiple times with delays and force refresh
      for (let i = 0; i < 3; i++) {
        await loadUserLiquidity(true) // Force refresh to bypass cache
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    } catch (error: any) {
      console.error('Remove liquidity error:', error)
      let errorMessage = error.reason || error.message || 'Failed to remove liquidity'
      
      if (error.message?.includes('Insufficient tokenA liquidity') || error.reason?.includes('Insufficient tokenA liquidity')) {
        errorMessage = 'Insufficient Token A liquidity. You can only remove what you deposited.'
      } else if (error.message?.includes('Insufficient tokenB liquidity') || error.reason?.includes('Insufficient tokenB liquidity')) {
        errorMessage = 'Insufficient Token B liquidity. You can only remove what you deposited.'
      } else if (error.message?.includes('Pool has insufficient reserves') || error.reason?.includes('Pool has insufficient reserves')) {
        errorMessage = 'Pool has insufficient reserves. Please try a smaller amount.'
      } else if (error.message?.includes('Cannot remove more') || error.reason?.includes('Cannot remove more')) {
        errorMessage = error.message || error.reason
      } else if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingRemoveLiquidity(false)
    }
  }

  const handleAddLiquidity = async () => {
    if (!liquidityAmountA || !liquidityAmountB || !liquidityTokenA || !liquidityTokenB) {
      showWarning('Please enter amounts and select both tokens')
      return
    }
    
    if (!ethers.isAddress(liquidityTokenA) || !ethers.isAddress(liquidityTokenB)) {
      showError('Invalid token addresses')
      return
    }
    
    if (liquidityTokenA.toLowerCase() === liquidityTokenB.toLowerCase()) {
      showError('Token A and Token B must be different')
      return
    }
    
    setIsLoadingAddLiquidity(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      // Use the currently selected pool - fetch fresh to ensure we have the latest
      // IMPORTANT: Always fetch the pool tokens fresh from the contract, don't rely on state
      const currentPoolAddress = selectedPool
      const fxPool = await getFXPool(currentPoolAddress)
      const poolAddress = await fxPool.getAddress()
      
      // Get the pool's expected tokens - ALWAYS fetch fresh from contract (don't rely on state)
      // This ensures we have the correct tokens even if the pool was changed
      const poolTokenA = await fxPool.tokenA()
      const poolTokenB = await fxPool.tokenB()
      
      // Check if pool was deployed with zero addresses (not initialized)
      if (poolTokenA === ethers.ZeroAddress || poolTokenB === ethers.ZeroAddress) {
        throw new Error(
          'FXPool was deployed with invalid token addresses (zero addresses). ' +
          'The pool needs to be redeployed with proper token addresses. ' +
          'Please redeploy the FXPool contract with valid Arc Network token addresses.'
        )
      }
      
      // Validate that selected tokens match pool tokens (order matters)
      const selectedTokenALower = liquidityTokenA.toLowerCase()
      const selectedTokenBLower = liquidityTokenB.toLowerCase()
      const poolTokenALower = poolTokenA.toLowerCase()
      const poolTokenBLower = poolTokenB.toLowerCase()
      
      // Check if tokens match in correct order
      const matchesCorrectOrder = selectedTokenALower === poolTokenALower && selectedTokenBLower === poolTokenBLower
      // Check if tokens match in reverse order
      const matchesReverseOrder = selectedTokenALower === poolTokenBLower && selectedTokenBLower === poolTokenALower
      
      if (!matchesCorrectOrder && !matchesReverseOrder) {
        // Provide more helpful error message with pool name
        let poolName = 'Unknown Pool'
        if (poolAddress.toLowerCase() === CONTRACT_ADDRESSES.fxPools.usdcEurc.toLowerCase()) {
          poolName = 'USDC/EURC Pool'
        }
        // USYC pools temporarily hidden - will be re-enabled when tokens and logo are available
        // else if (poolAddress.toLowerCase() === CONTRACT_ADDRESSES.fxPools.usdcUsyc.toLowerCase()) {
        //   poolName = 'USDC/USYC Pool'
        // } else if (poolAddress.toLowerCase() === CONTRACT_ADDRESSES.fxPools.eurcUsyc.toLowerCase()) {
        //   poolName = 'EURC/USYC Pool'
        // }
        
        throw new Error(
          `Selected tokens don't match ${poolName} tokens. ` +
          `Pool expects: ${poolTokenA} (Token A) and ${poolTokenB} (Token B). ` +
          `You selected: ${liquidityTokenA} (Token A) and ${liquidityTokenB} (Token B). ` +
          `Please select the correct tokens for this pool or change the pool selection.`
        )
      }
      
      // Get token decimals for pool tokens (not user's selected order)
      let poolTokenADecimals = 18
      let poolTokenBDecimals = 18
      try {
        const tokenAContract = getERC20(poolTokenA)
        poolTokenADecimals = await tokenAContract.decimals()
      } catch {
        // Default to 18
      }
      try {
        const tokenBContract = getERC20(poolTokenB)
        poolTokenBDecimals = await tokenBContract.decimals()
      } catch {
        // Default to 18
      }
      
      // Parse amounts based on user's input and selected tokens
      let userAmountA = ethers.parseUnits(liquidityAmountA, poolTokenADecimals)
      let userAmountB = ethers.parseUnits(liquidityAmountB, poolTokenBDecimals)
      
      // If tokens are in reverse order, swap the amounts to match pool's expected order
      let amountA: bigint
      let amountB: bigint
      if (matchesReverseOrder) {
        // User selected tokens in reverse order, swap amounts
        amountA = userAmountB // User's amountB goes to pool's tokenA
        amountB = userAmountA // User's amountA goes to pool's tokenB
      } else {
        // Tokens match in correct order
        amountA = userAmountA
        amountB = userAmountB
      }
      
      // Enforce 1:1 ratio - amounts must be equal
      // Use the smaller amount to ensure exact 1:1 ratio (prevent any rounding issues)
      const finalAmount = amountA < amountB ? amountA : amountB
      
      // Check if amounts are significantly different (more than 0.1% difference)
      const tolerance = (finalAmount * 1n) / 1000n // 0.1% tolerance
      const difference = amountA > amountB ? amountA - amountB : amountB - amountA
      
      if (difference > tolerance) {
        // Calculate the correct amount for token B to maintain 1:1 ratio
        const formattedAmountA = ethers.formatUnits(amountA, poolTokenADecimals)
        const formattedAmountB = ethers.formatUnits(amountB, poolTokenBDecimals)
        const formattedFinal = ethers.formatUnits(finalAmount, poolTokenADecimals)
        
        throw new Error(
          `Amounts must be in a 1:1 ratio. ` +
          `You entered ${formattedAmountA} of Token A and ${formattedAmountB} of Token B. ` +
          `For a 1:1 ratio, both amounts should be equal. ` +
          `Please adjust to ${formattedFinal} of each token.`
        )
      }
      
      // Use the smaller amount for both tokens to ensure exact 1:1 ratio
      amountA = finalAmount
      amountB = finalAmount
      
      // Approve both tokens - handle allowance errors gracefully
      // Always use pool's token addresses for approval (not user's selected order)
      const tokenA = await getERC20WithSigner(poolTokenA)
      const tokenB = await getERC20WithSigner(poolTokenB)
      
      // Check allowance for token A
      let allowanceA = 0n
      try {
        allowanceA = await tokenA.allowance(account, poolAddress)
      } catch (error: any) {
        // If allowance check fails, try to proceed with approval anyway
        allowanceA = 0n
      }
      
      if (allowanceA < amountA) {
        try {
          const approveTx = await tokenA.approve(poolAddress, amountA)
          await approveTx.wait()
        } catch (error: any) {
          throw new Error(`Token A approval failed: ${error.message || 'Unknown error'}`)
        }
      }
      
      // Check allowance for token B
      let allowanceB = 0n
      try {
        allowanceB = await tokenB.allowance(account, poolAddress)
      } catch (error: any) {
        // If allowance check fails, try to proceed with approval anyway
        allowanceB = 0n
      }
      
      if (allowanceB < amountB) {
        try {
          const approveTx = await tokenB.approve(poolAddress, amountB)
          await approveTx.wait()
        } catch (error: any) {
          throw new Error(`Token B approval failed: ${error.message || 'Unknown error'}`)
        }
      }
      
      const tx = await fxPool.addLiquidity(amountA, amountB)
      const receipt = await tx.wait()
      showSuccess('Liquidity added successfully!')
      setLiquidityAmountA('')
      setLiquidityAmountB('')
      setLiquidityTokenA('')
      setLiquidityTokenB('')
      
      // Wait a bit for blockchain state to update, then refresh
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Reload reserves and user liquidity
      await Promise.all([
        loadReserves(),
        loadUserLiquidity()
      ])
    } catch (error: any) {
      console.error('Add liquidity error:', error)
      let errorMessage = error.reason || error.message || 'Failed to add liquidity'
      
      if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      } else if (error.message?.includes('approval')) {
        errorMessage = error.message
      } else if (error.message?.includes('Ratio mismatch') || error.message?.includes('ratio')) {
        errorMessage = error.message || 'Amount ratio mismatch. Please adjust the amounts to match the pool ratio.'
      } else if (error.message?.includes("don't match pool tokens")) {
        errorMessage = error.message
      } else if (error.message?.includes('Amount B too')) {
        errorMessage = error.message
      } else if (error.data) {
        // Try to decode custom error
        errorMessage = `Transaction failed: ${error.message || 'Unknown error'}. Check browser console for details.`
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingAddLiquidity(false)
    }
  }
  
  const handleRebalanceTo5050 = async () => {
    // Check if user is admin
    if (!account || account.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
      showError('Only the admin address can rebalance pools')
      return
    }
    
    if (!selectedPool) {
      showWarning('Please select a pool to rebalance')
      return
    }
    
    setIsLoadingRemoveLiquidity(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const fxPool = await getFXPool(selectedPool)
      const poolAddress = await fxPool.getAddress()
      
      // Check if pool has liquidity
      const [reserveA, reserveB] = await fxPool.getReserves()
      if (reserveA === 0n || reserveB === 0n) {
        throw new Error('Pool has no liquidity. Please add liquidity first.')
      }
      
      // Get pool tokens to determine which token needs to be added
      const poolTokenA = await fxPool.tokenA()
      const poolTokenB = await fxPool.tokenB()
      
      // Calculate which token needs to be added and how much (same logic as script)
      let tokenToAdd: string
      let amountToAdd: bigint
      
      if (reserveA > reserveB) {
        // ReserveA is higher, need to add tokenB
        tokenToAdd = poolTokenB
        amountToAdd = BigInt(reserveA) - BigInt(reserveB)
      } else if (reserveB > reserveA) {
        // ReserveB is higher, need to add tokenA
        tokenToAdd = poolTokenA
        amountToAdd = BigInt(reserveB) - BigInt(reserveA)
      } else {
        // Already balanced
        showInfo('Pool is already balanced at 50:50!')
        return
      }
      
      // Get token decimals
      let tokenDecimals = 18
      try {
        const tokenContract = getERC20(tokenToAdd)
        tokenDecimals = await tokenContract.decimals()
      } catch {
        tokenDecimals = 18
      }
      
      // Check balance
      const tokenWithSigner = await getERC20WithSigner(tokenToAdd)
      const balance = await tokenWithSigner.balanceOf(account)
      
      if (balance < amountToAdd) {
        const formattedAmount = ethers.formatUnits(amountToAdd, tokenDecimals)
        const formattedBalance = ethers.formatUnits(balance, tokenDecimals)
        throw new Error(`Insufficient balance. Need ${formattedAmount}, have ${formattedBalance}`)
      }
      
      // Approve token (approve 2x to be safe, like the script)
      const approvalAmount = amountToAdd * 2n
      const allowance = await tokenWithSigner.allowance(account, poolAddress)
      if (allowance < amountToAdd) {
        const approveTx = await tokenWithSigner.approve(poolAddress, approvalAmount)
        await approveTx.wait()
      }
      
      // Call rebalanceTo5050() - this will automatically add the needed token
      const tx = await fxPool.rebalanceTo5050()
      const receipt = await tx.wait()
      
      // Verify the rebalancing
      const [newReserveA, newReserveB] = await fxPool.getReserves()
      
      if (newReserveA === newReserveB) {
        showSuccess('Pool successfully rebalanced to perfect 50:50 ratio!')
      } else {
        const diff = newReserveA > newReserveB ? newReserveA - newReserveB : newReserveB - newReserveA
        const maxReserve = newReserveA > newReserveB ? newReserveA : newReserveB
        const imbalance = (BigInt(diff) * 10000n) / BigInt(maxReserve)
        if (imbalance <= 100n) {
          showSuccess('Pool successfully rebalanced! (within 1% of 50:50)')
        } else {
          showInfo('Pool rebalanced, but small difference remains. You may need to run rebalance again.')
        }
      }
      
      loadReserves()
    } catch (error: any) {
      console.error('Rebalance error:', error)
      let errorMessage = error.reason || error.message || 'Failed to rebalance pool'
      
      if (error.message?.includes('OwnableUnauthorizedAccount') || error.message?.includes('not the owner')) {
        errorMessage = 'Only the contract owner can rebalance pools'
      } else if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      } else if (error.message?.includes('Pool must have liquidity')) {
        errorMessage = 'Pool must have liquidity before rebalancing'
      } else if (error.message?.includes('Insufficient balance')) {
        errorMessage = error.message
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingRebalance(false)
    }
  }
  
  const handleWithdrawAllLiquidity = async () => {
    // Check if user is admin
    if (!account || account.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
      showError('Only the admin address can withdraw all liquidity')
      return
    }
    
    // Determine recipient address
    const recipient = withdrawRecipient.trim() || account
    if (!ethers.isAddress(recipient)) {
      showError('Invalid recipient address')
      return
    }
    
    // Check if pool has liquidity
    if (reserves[0] === '0' && reserves[1] === '0') {
      showWarning('Pool has no liquidity to withdraw')
      return
    }
    
    // Confirm action
    const confirmMessage = `Are you sure you want to withdraw ALL liquidity from this pool?\n\n` +
      `Current reserves:\n` +
      `Token A: ${reserves[0]}\n` +
      `Token B: ${reserves[1]}\n\n` +
      `Recipient: ${recipient}\n\n` +
      `This action cannot be undone!`
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    setIsLoadingWithdrawAll(true)
    try {
      // Ensure we're on Arc Testnet
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const fxPool = await getFXPool(selectedPool)
      
      // Call withdrawAllLiquidity
      const tx = await fxPool.withdrawAllLiquidity(recipient)
      const receipt = await tx.wait()
      
      showSuccess(`All liquidity successfully withdrawn to ${recipient}!`)
      setWithdrawRecipient('')
      loadReserves()
    } catch (error: any) {
      console.error('Withdraw all liquidity error:', error)
      let errorMessage = error.reason || error.message || 'Failed to withdraw all liquidity'
      
      if (error.message?.includes('OwnableUnauthorizedAccount') || error.message?.includes('not the owner')) {
        errorMessage = 'Only the contract owner can withdraw all liquidity'
      } else if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      } else if (error.message?.includes('No liquidity')) {
        errorMessage = 'Pool has no liquidity to withdraw'
      } else if (error.message?.includes('Invalid recipient')) {
        errorMessage = 'Invalid recipient address'
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingWithdrawAll(false)
    }
  }
  
  const handleRegisterPool = async () => {
    // Check if user is admin
    if (!account || account.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
      showError('Only the admin address can register pools')
      return
    }
    
    if (!poolTokenA || !poolTokenB) {
      showWarning('Please select both tokens')
      return
    }
    
    if (!ethers.isAddress(poolTokenA) || !ethers.isAddress(poolTokenB)) {
      showError('Invalid token addresses')
      return
    }
    
    if (poolTokenA.toLowerCase() === poolTokenB.toLowerCase()) {
      showError('Token A and Token B must be different')
      return
    }
    
    setIsLoadingRegisterPool(true)
    try {
      // Ensure we're on Arc Testnet
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const stablecoinSwap = await getStablecoinSwap()
      // Use the selected pool or the pool matching the token pair
      let fxPoolAddress = selectedPool
      
      // If tokens match a specific pool, use that pool
      const tokenALower = poolTokenA.toLowerCase()
      const tokenBLower = poolTokenB.toLowerCase()
      const usdc = '0x3600000000000000000000000000000000000000'.toLowerCase()
      const eurc = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'.toLowerCase()
      // USYC temporarily hidden - will be re-enabled when tokens and logo are available
      // const usyc = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C'.toLowerCase()
      
      if ((tokenALower === usdc && tokenBLower === eurc) || (tokenALower === eurc && tokenBLower === usdc)) {
        fxPoolAddress = CONTRACT_ADDRESSES.fxPools.usdcEurc
      }
      // USYC pools temporarily hidden - will be re-enabled when tokens and logo are available
      // else if ((tokenALower === usdc && tokenBLower === usyc) || (tokenALower === usyc && tokenBLower === usdc)) {
      //   fxPoolAddress = CONTRACT_ADDRESSES.fxPools.usdcUsyc
      // } else if ((tokenALower === eurc && tokenBLower === usyc) || (tokenALower === usyc && tokenBLower === eurc)) {
      //   fxPoolAddress = CONTRACT_ADDRESSES.fxPools.eurcUsyc
      // }
      
      // Check if pool already registered
      const existingPool = await stablecoinSwap.pools(poolTokenA, poolTokenB)
      if (existingPool !== ethers.ZeroAddress) {
        showInfo('This pool is already registered')
        setIsLoadingRegisterPool(false)
        return
      }
      
      const tx = await stablecoinSwap.registerPool(fxPoolAddress, poolTokenA, poolTokenB)
      const receipt = await tx.wait()
      
      showSuccess('Pool registered successfully!')
      setPoolTokenA('')
      setPoolTokenB('')
    } catch (error: any) {
      console.error('Register pool error:', error)
      let errorMessage = error.reason || error.message || 'Failed to register pool'
      
      if (error.message?.includes('OwnableUnauthorizedAccount') || error.message?.includes('not the owner')) {
        errorMessage = 'Only the contract owner can register pools'
      } else if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingRegisterPool(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* Main Exchange Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="workbird-card rounded-2xl p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowLeftRight className="h-6 w-6 icon-gradient icon-glow" />
            </motion.div>
            <span>Exchange</span>
          </h2>
        </div>

        {/* Mode Switcher */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 workbird-input rounded-xl p-1">
            <button
              onClick={() => setActiveMode('swap')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                activeMode === 'swap'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Swap
            </button>
            <button
              onClick={() => setActiveMode('liquidity')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                activeMode === 'liquidity'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Liquidity
            </button>
          </div>
        </div>

        {/* Swap Mode */}
        {activeMode === 'swap' && (
          <>
            {/* From Section */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">From</label>
          <div 
            onClick={() => setShowTokenInSelector(!showTokenInSelector)}
            className="workbird-input rounded-xl p-4 cursor-pointer hover:border-blue-500 transition-all"
          >
            <div className="flex items-center space-x-3">
              {tokenIn && tokenInInfo?.logo ? (
                <img 
                  src={tokenInInfo.logo} 
                  alt={tokenInInfo.symbol}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Circle className="h-6 w-6 text-slate-400" />
                </div>
              )}
              <div className="flex-1">
                {tokenIn ? (
                  <div className="text-slate-900 dark:text-white font-semibold text-lg">
                    {tokenInInfo?.symbol || (() => {
                      const tokenConfig = getTokenByAddress(tokenIn)
                      return tokenConfig?.symbol || tokenIn.slice(0, 6) + '...' + tokenIn.slice(-4)
                    })()}
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400">Select token</div>
                )}
              </div>
              <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </div>
          </div>
          {showTokenInSelector && (
            <div className="mt-2">
              <TokenSelector
                value={tokenIn}
                onChange={(value) => {
                  setTokenIn(value)
                  setShowTokenInSelector(false)
                }}
                label=""
                showCustomInput={true}
                defaultOpen={true}
              />
            </div>
          )}
        </div>

        {/* Arrow Separator */}
        <div className="flex justify-center my-4">
          <motion.button
            onClick={() => {
              const temp = tokenIn
              setTokenIn(tokenOut)
              setTokenOut(temp)
            }}
            className="p-3 jumper-icon rounded-full hover:bg-blue-600/30 transition-all"
            whileHover={{ scale: 1.2, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowDown className="h-5 w-5 text-slate-500 dark:text-slate-400 icon-glow" />
            </motion.div>
          </motion.button>
        </div>

        {/* To Section */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">To</label>
          <div 
            onClick={() => setShowTokenOutSelector(!showTokenOutSelector)}
            className="workbird-input rounded-xl p-4 cursor-pointer hover:border-blue-500 transition-all"
          >
            <div className="flex items-center space-x-3">
              {tokenOut && tokenOutInfo?.logo ? (
                <img 
                  src={tokenOutInfo.logo} 
                  alt={tokenOutInfo.symbol}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full jumper-icon flex items-center justify-center">
                  <Circle className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                </div>
              )}
              <div className="flex-1">
                {tokenOut ? (
                  <div className="text-slate-900 dark:text-white font-semibold text-lg">
                    {tokenOutInfo?.symbol || (() => {
                      const tokenConfig = getTokenByAddress(tokenOut)
                      return tokenConfig?.symbol || tokenOut.slice(0, 6) + '...' + tokenOut.slice(-4)
                    })()}
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400">Select token</div>
                )}
              </div>
              <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </div>
          </div>
          {showTokenOutSelector && (
            <div className="mt-2">
              <TokenSelector
                value={tokenOut}
                onChange={(value) => {
                  setTokenOut(value)
                  setShowTokenOutSelector(false)
                }}
                label=""
                showCustomInput={true}
                defaultOpen={true}
              />
            </div>
          )}
        </div>

        {/* Send Section */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Send</label>
          <div className="workbird-input rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-10 h-10 rounded-full jumper-icon flex items-center justify-center">
                  <Circle className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-3xl font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  />
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    ${quote !== '0' ? parseFloat(quote).toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exchange Button */}
        <button
          onClick={handleSwap}
          disabled={isLoadingSwap || !swapAmount || !tokenIn || !tokenOut}
          className="w-full px-6 py-4 workbird-button font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isLoadingSwap && <Loader2 className="h-5 w-5 animate-spin" />}
          <span>{isLoadingSwap ? 'Swapping...' : 'Exchange'}</span>
        </button>
          </>
        )}

        {/* Liquidity Mode */}
        {activeMode === 'liquidity' && (
          <>
            {/* Pool Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Select Pool</label>
              <select
                value={selectedPool}
                onChange={async (e) => {
                  const newPool = e.target.value
                  setSelectedPool(newPool)
                  setLiquidityAmountA('')
                  setLiquidityAmountB('')
                  try {
                    const fxPool = await getFXPool(newPool)
                    const [reserveA, reserveB] = await fxPool.getReserves()
                    const poolTokenA = await fxPool.tokenA()
                    const poolTokenB = await fxPool.tokenB()
                    setPoolTokenAddresses([poolTokenA, poolTokenB])
                    // Auto-set tokens to match the selected pool
                    setLiquidityTokenA(poolTokenA)
                    setLiquidityTokenB(poolTokenB)
                    loadReserves()
                  } catch (error) {
                    console.error('Error loading new pool:', error)
                  }
                }}
                className="w-full workbird-input rounded-xl px-4 py-3"
              >
                <option value={CONTRACT_ADDRESSES.fxPools.usdcEurc}>USDC/EURC Pool</option>
                {/* USYC pools temporarily hidden - will be re-enabled when tokens and logo are available */}
                {/* <option value={CONTRACT_ADDRESSES.fxPools.usdcUsyc}>USDC/USYC Pool</option> */}
                {/* <option value={CONTRACT_ADDRESSES.fxPools.eurcUsyc}>EURC/USYC Pool</option> */}
              </select>
              {poolTokenAddresses[0] && poolTokenAddresses[1] && poolTokenAddresses[0] !== ethers.ZeroAddress && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Pool tokens: {poolTokenAddresses[0].slice(0, 6)}...{poolTokenAddresses[0].slice(-4)} / {poolTokenAddresses[1].slice(0, 6)}...{poolTokenAddresses[1].slice(-4)}
                </p>
              )}
            </div>

            {/* Current Reserves */}
            <div className="mb-6 workbird-input rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Pool Reserves</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {poolTokenAddresses[0] ? (() => {
                      const tokenConfig = getTokenByAddress(poolTokenAddresses[0])
                      return tokenConfig?.symbol || poolTokenAddresses[0].slice(0, 6) + '...' + poolTokenAddresses[0].slice(-4)
                    })() : 'Token A'}
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{reserves[0]}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {poolTokenAddresses[1] ? (() => {
                      const tokenConfig = getTokenByAddress(poolTokenAddresses[1])
                      return tokenConfig?.symbol || poolTokenAddresses[1].slice(0, 6) + '...' + poolTokenAddresses[1].slice(-4)
                    })() : 'Token B'}
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{reserves[1]}</p>
                </div>
              </div>
            </div>

            {/* Token A Display (Read-only) */}
            <div className="mb-4">
              <div className="workbird-input rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                {liquidityTokenA ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {(() => {
                        const tokenConfig = getTokenByAddress(liquidityTokenA)
                        return tokenConfig?.logo ? (
                          <img src={tokenConfig.logo} alt={tokenConfig.symbol} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              {liquidityTokenA.slice(2, 4).toUpperCase()}
                            </span>
                          </div>
                        )
                      })()}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {(() => {
                            const tokenConfig = getTokenByAddress(liquidityTokenA)
                            return tokenConfig?.symbol || liquidityTokenA.slice(0, 6) + '...' + liquidityTokenA.slice(-4)
                          })()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {(() => {
                            const tokenConfig = getTokenByAddress(liquidityTokenA)
                            return tokenConfig?.name || 'Custom Token'
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">Select a pool first</span>
                )}
              </div>
            </div>

            {/* Amount A */}
            <div className="mb-4">
              <input
                type="number"
                value={liquidityAmountA}
                onChange={(e) => {
                  const value = e.target.value
                  setLiquidityAmountA(value)
                  // Auto-sync Amount B to maintain 1:1 ratio
                  setLiquidityAmountB(value)
                }}
                placeholder="0.0"
                className="w-full workbird-input rounded-xl px-4 py-3 placeholder-slate-400"
              />
            </div>

            {/* Token B Display (Read-only) */}
            <div className="mb-4">
              <div className="workbird-input rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                {liquidityTokenB ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {(() => {
                        const tokenConfig = getTokenByAddress(liquidityTokenB)
                        return tokenConfig?.logo ? (
                          <img src={tokenConfig.logo} alt={tokenConfig.symbol} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              {liquidityTokenB.slice(2, 4).toUpperCase()}
                            </span>
                          </div>
                        )
                      })()}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {(() => {
                            const tokenConfig = getTokenByAddress(liquidityTokenB)
                            return tokenConfig?.symbol || liquidityTokenB.slice(0, 6) + '...' + liquidityTokenB.slice(-4)
                          })()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {(() => {
                            const tokenConfig = getTokenByAddress(liquidityTokenB)
                            return tokenConfig?.name || 'Custom Token'
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">Select a pool first</span>
                )}
              </div>
            </div>

            {/* Amount B */}
            <div className="mb-6">
              <input
                type="number"
                value={liquidityAmountB}
                onChange={(e) => {
                  const value = e.target.value
                  setLiquidityAmountB(value)
                  // Auto-sync Amount A to maintain 1:1 ratio
                  setLiquidityAmountA(value)
                }}
                placeholder="0.0"
                className="w-full workbird-input rounded-xl px-4 py-3 placeholder-slate-400"
              />
            </div>

            {/* Add Liquidity Button */}
            <button
              onClick={handleAddLiquidity}
              disabled={isLoadingAddLiquidity || !liquidityAmountA || !liquidityAmountB || !liquidityTokenA || !liquidityTokenB}
              className="w-full px-6 py-4 workbird-button font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoadingAddLiquidity && <Loader2 className="h-5 w-5 animate-spin" />}
              <span>{isLoadingAddLiquidity ? 'Adding Liquidity...' : 'Add Liquidity'}</span>
            </button>
            
            {/* User's Liquidity Balance */}
            {account && (
              <div className="mt-6 workbird-card rounded-xl p-4 border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Your Liquidity</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        // First, let's verify what the contract actually returns
                        try {
                          const { getProvider } = await import('@/lib/web3')
                          const { FX_POOL_ABI } = await import('@/lib/abis')
                          const provider = getProvider()
                          const fxPoolReadOnly = new ethers.Contract(selectedPool, FX_POOL_ABI, provider)
                          const [rawA, rawB] = await fxPoolReadOnly.getUserLiquidity(account)
                          
                          // Force state reset first
                          setUserLiquidityA('0')
                          setUserLiquidityB('0')
                          
                          // Then load fresh
                          await loadUserLiquidity(true)
                          showInfo('Liquidity balance refreshed from contract')
                        } catch (error) {
                          console.error('Error refreshing:', error)
                          showError('Failed to refresh liquidity balance')
                        }
                      }}
                      className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      title="Refresh liquidity balance from contract"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => {
                        // Force reset to 0 (for debugging)
                        setUserLiquidityA('0')
                        setUserLiquidityB('0')
                        showInfo('State reset to 0. Click Refresh to load from contract.')
                      }}
                      className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Reset state to 0 (debug)"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {poolTokenAddresses[0] ? (() => {
                        const tokenConfig = getTokenByAddress(poolTokenAddresses[0])
                        return tokenConfig?.symbol || poolTokenAddresses[0].slice(0, 6) + '...' + poolTokenAddresses[0].slice(-4)
                      })() : 'Token A'}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{userLiquidityA || '0'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {poolTokenAddresses[1] ? (() => {
                        const tokenConfig = getTokenByAddress(poolTokenAddresses[1])
                        return tokenConfig?.symbol || poolTokenAddresses[1].slice(0, 6) + '...' + poolTokenAddresses[1].slice(-4)
                      })() : 'Token B'}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{userLiquidityB || '0'}</p>
                  </div>
                </div>
                
                {/* Remove Liquidity Section */}
                {(parseFloat(userLiquidityA) > 0 || parseFloat(userLiquidityB) > 0) && (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Remove Liquidity</h4>
                  <div>
                    <input
                      type="number"
                      value={removeLiquidityAmount}
                      onChange={(e) => setRemoveLiquidityAmount(e.target.value)}
                      placeholder="0.0"
                      max={Math.min(parseFloat(userLiquidityA), parseFloat(userLiquidityB))}
                      className="w-full workbird-input rounded-xl px-4 py-3 placeholder-slate-400"
                    />
                    <button
                      onClick={() => {
                        const maxRemovable = Math.min(parseFloat(userLiquidityA), parseFloat(userLiquidityB))
                        setRemoveLiquidityAmount(maxRemovable.toString())
                      }}
                      className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Max: {Math.min(parseFloat(userLiquidityA), parseFloat(userLiquidityB)).toFixed(6)}
                    </button>
                  </div>
                  
                  <button
                    onClick={handleRemoveLiquidity}
                    disabled={isLoadingRemoveLiquidity || !removeLiquidityAmount || parseFloat(removeLiquidityAmount) > Math.min(parseFloat(userLiquidityA), parseFloat(userLiquidityB)) || parseFloat(removeLiquidityAmount) <= 0}
                    className="w-full px-4 py-3 workbird-button-secondary font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isLoadingRemoveLiquidity && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{isLoadingRemoveLiquidity ? 'Removing...' : 'Remove Liquidity'}</span>
                  </button>
                </div>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Admin Section - Register Pool */}
      {isOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="workbird-card rounded-2xl p-6 mt-6 border-2 border-purple-500"
        >
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <AlertCircle className="h-6 w-6 text-slate-500 dark:text-slate-400 icon-glow" />
            </motion.div>
            <span>Admin: Register Pool</span>
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
            Register a new FX pool for token pairs. This allows users to swap between the two tokens.
            Available pools:
            <br />• USDC/EURC: {CONTRACT_ADDRESSES.fxPools.usdcEurc.slice(0, 6)}...{CONTRACT_ADDRESSES.fxPools.usdcEurc.slice(-4)}
            {/* USYC pools temporarily hidden - will be re-enabled when tokens and logo are available */}
            {/* <br />• USDC/USYC: {CONTRACT_ADDRESSES.fxPools.usdcUsyc.slice(0, 6)}...{CONTRACT_ADDRESSES.fxPools.usdcUsyc.slice(-4)} */}
            {/* <br />• EURC/USYC: {CONTRACT_ADDRESSES.fxPools.eurcUsyc.slice(0, 6)}...{CONTRACT_ADDRESSES.fxPools.eurcUsyc.slice(-4)} */}
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Token A
              </label>
              <TokenSelector
                value={poolTokenA}
                onChange={setPoolTokenA}
                label=""
                showCustomInput={true}
              />
              {poolTokenA && <TokenInfo address={poolTokenA} />}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Token B
              </label>
              <TokenSelector
                value={poolTokenB}
                onChange={setPoolTokenB}
                label=""
                showCustomInput={true}
              />
              {poolTokenB && <TokenInfo address={poolTokenB} />}
            </div>
            <button
              onClick={handleRegisterPool}
              disabled={isLoadingRegisterPool || !poolTokenA || !poolTokenB}
              className="w-full px-4 py-2 workbird-button font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingRegisterPool && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoadingRegisterPool ? 'Registering Pool...' : 'Register Pool'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Admin Section - Rebalance Pool to 50:50 */}
      {isOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="workbird-card rounded-2xl p-6 mt-6 border-2 border-purple-500"
        >
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.2, rotate: 90 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Plus className="h-6 w-6 text-slate-500 dark:text-slate-400 icon-glow" />
            </motion.div>
            <span>Admin: Rebalance Pool to 50:50</span>
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
            Automatically rebalance the selected pool to a perfect 50:50 ratio. The contract will calculate and add the required token amount to achieve balance.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Pool
              </label>
              <select
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
                className="w-full workbird-input rounded-xl px-4 py-3"
              >
                <option value={CONTRACT_ADDRESSES.fxPools.usdcEurc}>
                  USDC/EURC Pool
                </option>
                {/* USYC pools temporarily hidden - will be re-enabled when tokens and logo are available */}
                {/* <option value={CONTRACT_ADDRESSES.fxPools.usdcUsyc}>
                  USDC/USYC Pool
                </option>
                <option value={CONTRACT_ADDRESSES.fxPools.eurcUsyc}>
                  EURC/USYC Pool
                </option> */}
              </select>
            </div>
            <div className="workbird-input rounded-xl p-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong>Current Reserves:</strong>{' '}
                {poolTokenAddresses[0] && poolTokenAddresses[1] ? (() => {
                  const tokenConfigA = getTokenByAddress(poolTokenAddresses[0])
                  const tokenNameA = tokenConfigA?.symbol || poolTokenAddresses[0].slice(0, 6) + '...' + poolTokenAddresses[0].slice(-4)
                  const tokenConfigB = getTokenByAddress(poolTokenAddresses[1])
                  const tokenNameB = tokenConfigB?.symbol || poolTokenAddresses[1].slice(0, 6) + '...' + poolTokenAddresses[1].slice(-4)
                  return `${tokenNameA}: ${reserves[0]} / ${tokenNameB}: ${reserves[1]}`
                })() : `${reserves[0]} / ${reserves[1]}`}
              </p>
            </div>
            <button
              onClick={handleRebalanceTo5050}
              disabled={isLoadingRebalance || !selectedPool}
              className="w-full px-4 py-2 workbird-button font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingRebalance && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoadingRebalance ? 'Rebalancing...' : 'Rebalance to 50:50'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Admin Section - Withdraw All Liquidity */}
      {isOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="workbird-card rounded-2xl p-6 mt-6 border-2 border-red-500/50"
        >
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Minus className="h-6 w-6 text-red-400 icon-glow" />
            </motion.div>
            <span>Admin: Withdraw All Liquidity</span>
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
            <span className="font-semibold text-red-400">⚠️ WARNING:</span> This will withdraw ALL liquidity from the selected pool.
            The recipient address will receive all tokens currently in the pool reserves.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Pool
              </label>
              <select
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
                className="w-full workbird-input rounded-xl px-4 py-3"
              >
                <option value={CONTRACT_ADDRESSES.fxPools.usdcEurc}>
                  USDC/EURC Pool
                </option>
                {/* USYC pools temporarily hidden - will be re-enabled when tokens and logo are available */}
                {/* <option value={CONTRACT_ADDRESSES.fxPools.usdcUsyc}>
                  USDC/USYC Pool
                </option>
                <option value={CONTRACT_ADDRESSES.fxPools.eurcUsyc}>
                  EURC/USYC Pool
                </option> */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={withdrawRecipient}
                onChange={(e) => setWithdrawRecipient(e.target.value)}
                placeholder={account || "0x..."}
                className="w-full workbird-input rounded-xl px-4 py-3 placeholder-slate-400"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Leave empty to withdraw to your connected address ({account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'})
              </p>
            </div>
            <div className="workbird-input rounded-xl p-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Pool Reserves:</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {poolTokenAddresses[0] ? (() => {
                  const tokenConfigA = getTokenByAddress(poolTokenAddresses[0])
                  const tokenNameA = tokenConfigA?.symbol || poolTokenAddresses[0].slice(0, 6) + '...' + poolTokenAddresses[0].slice(-4)
                  const tokenConfigB = getTokenByAddress(poolTokenAddresses[1])
                  const tokenNameB = tokenConfigB?.symbol || poolTokenAddresses[1].slice(0, 6) + '...' + poolTokenAddresses[1].slice(-4)
                  return `${tokenNameA}: ${reserves[0]} | ${tokenNameB}: ${reserves[1]}`
                })() : `Token A: ${reserves[0]} | Token B: ${reserves[1]}`}
              </p>
            </div>
            <button
              onClick={handleWithdrawAllLiquidity}
              disabled={isLoadingWithdrawAll || (reserves[0] === '0' && reserves[1] === '0')}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoadingWithdrawAll && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoadingWithdrawAll ? 'Withdrawing...' : 'Withdraw All Liquidity'}</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

