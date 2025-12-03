'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Shield, AlertCircle, Database, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { getLendingPool, getCollateralManager, getERC20WithSigner, getProvider, getERC20 } from '@/lib/web3'
import { TokenSelector } from './TokenSelector'
import { TokenInfo } from './TokenInfo'
import { ADMIN_ADDRESS } from '@/config/contracts'
import { TOKENS, getTokenByAddress } from '@/config/tokens'
import { ethers } from 'ethers'
import { useToast } from '@/contexts/ToastContext'

interface LendingDashboardProps {
  account: string
}

export function LendingDashboard({ account }: LendingDashboardProps) {
  const { showSuccess, showError, showWarning, showInfo } = useToast()
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [borrowAmount, setBorrowAmount] = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [depositAsCollateral, setDepositAsCollateral] = useState(false)
  const [withdrawFromCollateral, setWithdrawFromCollateral] = useState(false)
  const [tokenAddress, setTokenAddress] = useState('')
  const [depositBalance, setDepositBalance] = useState('0')
  const [borrowBalance, setBorrowBalance] = useState('0')
  const [maxBorrow, setMaxBorrow] = useState('0')
  const [isLoadingDeposit, setIsLoadingDeposit] = useState(false)
  const [isLoadingWithdraw, setIsLoadingWithdraw] = useState(false)
  const [isLoadingBorrow, setIsLoadingBorrow] = useState(false)
  const [isLoadingRepay, setIsLoadingRepay] = useState(false)
  const [isLoadingAddMarket, setIsLoadingAddMarket] = useState(false)
  const [isLoadingConfigureCollateral, setIsLoadingConfigureCollateral] = useState(false)
  
  // Admin state
  const [isOwner, setIsOwner] = useState(false)
  const [newMarketToken, setNewMarketToken] = useState('')
  const [reserveFactor, setReserveFactor] = useState('1000') // Default 10% (1000 basis points)
  
  // Collateral configuration state
  const [newCollateralToken, setNewCollateralToken] = useState('')
  const [ltv, setLtv] = useState('7500') // Default 75% LTV
  const [liquidationThreshold, setLiquidationThreshold] = useState('8000') // Default 80%
  
  // Deposits and collaterals state
  interface DepositInfo {
    tokenAddress: string
    tokenSymbol: string
    tokenName: string
    amount: string
    decimals: number
  }
  const [depositedAssets, setDepositedAssets] = useState<DepositInfo[]>([])
  const [depositedCollaterals, setDepositedCollaterals] = useState<DepositInfo[]>([])
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false)
  
  // TVL Stats
  const [tvlStats, setTvlStats] = useState<{ token: string; symbol: string; totalDeposits: string; totalBorrows: string }[]>([])
  const [isLoadingTvl, setIsLoadingTvl] = useState(false)

  useEffect(() => {
    loadBalances()
    loadTvlStats()
    if (account) {
      checkOwner()
      loadAllDepositsAndCollaterals()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, tokenAddress])
  
  // Load TVL stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadTvlStats()
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  // Auto-adjust withdraw amount when checkbox changes if amount exceeds available balance
  useEffect(() => {
    const adjustWithdrawAmount = async () => {
      if (!withdrawAmount || !tokenAddress || !account) {
        return
      }

      try {
        // Get token decimals
        let tokenDecimals = 18
        try {
          const token = getERC20(tokenAddress)
          tokenDecimals = await token.decimals()
        } catch {
          tokenDecimals = 18
        }

        const enteredAmount = ethers.parseUnits(withdrawAmount, tokenDecimals)

        if (withdrawFromCollateral) {
          // Check collateral balance
          const collateralManager = await getCollateralManager()
          const collateralBalance = await collateralManager.collateralBalances(account, tokenAddress)
          
          if (enteredAmount > collateralBalance && collateralBalance > 0n) {
            // Adjust to max collateral balance, rounded down to avoid precision errors
            const maxAmountFormatted = ethers.formatUnits(collateralBalance, tokenDecimals)
            const amountAsNumber = parseFloat(maxAmountFormatted)
            const roundedDown = Math.floor(amountAsNumber * 1000) / 1000
            const maxAmount = roundedDown > 0 ? roundedDown.toFixed(3) : ''
            setWithdrawAmount(maxAmount)
          } else if (collateralBalance === 0n && enteredAmount > 0n) {
            // No collateral available, clear the amount
            setWithdrawAmount('')
          }
        } else {
          // Check deposit balance
          const lendingPool = await getLendingPool()
          const depositBalance = await lendingPool.getDepositBalance(account, tokenAddress)
          
          if (enteredAmount > depositBalance && depositBalance > 0n) {
            // Adjust to max deposit balance, rounded down to avoid precision errors
            const maxAmountFormatted = ethers.formatUnits(depositBalance, tokenDecimals)
            const amountAsNumber = parseFloat(maxAmountFormatted)
            const roundedDown = Math.floor(amountAsNumber * 1000) / 1000
            const maxAmount = roundedDown > 0 ? roundedDown.toFixed(3) : ''
            setWithdrawAmount(maxAmount)
          } else if (depositBalance === 0n && enteredAmount > 0n) {
            // No deposit available, clear the amount
            setWithdrawAmount('')
          }
        }
      } catch (error) {
        // Silently fail - user can manually adjust
        console.warn('Error adjusting withdraw amount:', error)
      }
    }

    adjustWithdrawAmount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawFromCollateral, tokenAddress, account])
  
  const checkOwner = () => {
    // Check if the connected account matches the admin address
    if (!account) {
      setIsOwner(false)
      return
    }
    setIsOwner(account.toLowerCase() === ADMIN_ADDRESS.toLowerCase())
  }
  
  const loadTvlStats = async () => {
    setIsLoadingTvl(true)
    try {
      const lendingPool = await getLendingPool()
      const stats: { token: string; symbol: string; totalDeposits: string; totalBorrows: string }[] = []
      
      // Get all enabled tokens from TOKENS config
      for (const token of TOKENS) {
        try {
          const market = await lendingPool.markets(token.address)
          
          // Check if market is enabled
          if (market && Array.isArray(market) && market.length >= 5 && market[4]) {
            const totalDeposits = BigInt(market[1].toString())
            const totalBorrows = BigInt(market[2].toString())
            
            // Get token decimals
            let tokenDecimals = token.decimals || 18
            try {
              const tokenContract = getERC20(token.address)
              const decimals = await tokenContract.decimals()
              tokenDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
            } catch {
              // Use default from config
            }
            
            const depositsFormatted = ethers.formatUnits(totalDeposits, tokenDecimals)
            const borrowsFormatted = ethers.formatUnits(totalBorrows, tokenDecimals)
            
            stats.push({
              token: token.address,
              symbol: token.symbol,
              totalDeposits: parseFloat(depositsFormatted).toFixed(2),
              totalBorrows: parseFloat(borrowsFormatted).toFixed(2),
            })
          }
        } catch (error) {
          // Market might not exist or not be enabled, skip it
          console.warn(`Error loading TVL for ${token.symbol}:`, error)
        }
      }
      
      setTvlStats(stats)
    } catch (error) {
      console.error('Error loading TVL stats:', error)
    } finally {
      setIsLoadingTvl(false)
    }
  }
  
  const handleConfigureCollateral = async () => {
    // Check if user is admin
    if (!account || account.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
      showError('Only the admin address can configure collateral')
      return
    }
    
    if (!newCollateralToken || !ltv || !liquidationThreshold) {
      showWarning('Please enter token address, LTV, and liquidation threshold')
      return
    }
    
    if (!ethers.isAddress(newCollateralToken)) {
      showError('Invalid token address')
      return
    }
    
    const ltvValue = BigInt(ltv)
    const thresholdValue = BigInt(liquidationThreshold)
    
    if (ltvValue >= thresholdValue) {
      showError('LTV must be less than liquidation threshold')
      return
    }
    
    if (thresholdValue > 10000n) {
      showError('Liquidation threshold cannot exceed 10000 (100%)')
      return
    }
    
    setIsLoadingConfigureCollateral(true)
    try {
      // Ensure we're on Arc Testnet
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const collateralManager = await getCollateralManager()
      
      // Check if collateral already configured
      try {
        const config = await collateralManager.collateralConfigs(newCollateralToken)
        if (config && Array.isArray(config) && config.length >= 4 && config[3]) {
          showInfo('This collateral is already configured and enabled')
          setIsLoadingConfigureCollateral(false)
          return
        }
      } catch {
        // Collateral not configured, continue
      }
      
      const tx = await collateralManager.configureCollateral(newCollateralToken, ltvValue, thresholdValue)
      console.log('Configure collateral transaction sent:', tx.hash)
      const receipt = await tx.wait()
      console.log('Collateral configured in block:', receipt.blockNumber)
      
      showSuccess('Collateral configured successfully!')
      setNewCollateralToken('')
      setLtv('7500')
      setLiquidationThreshold('8000')
    } catch (error: any) {
      console.error('Configure collateral error:', error)
      let errorMessage = error.reason || error.message || 'Failed to configure collateral'
      
      if (error.message?.includes('OwnableUnauthorizedAccount') || error.message?.includes('not the owner')) {
        errorMessage = 'Only the contract owner can configure collateral'
      } else if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      } else if (error.message?.includes('Invalid thresholds')) {
        errorMessage = 'LTV must be less than liquidation threshold'
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingConfigureCollateral(false)
    }
  }
  
  const handleAddMarket = async () => {
    if (!newMarketToken || !reserveFactor) {
      showWarning('Please enter token address and reserve factor')
      return
    }
    
    if (!ethers.isAddress(newMarketToken)) {
      showError('Invalid token address')
      return
    }
    
    setIsLoadingAddMarket(true)
    try {
      // Ensure we're on Arc Testnet
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const lendingPool = await getLendingPool()
      
      // Check if market already exists
      try {
        const market = await lendingPool.markets(newMarketToken)
        if (market && Array.isArray(market) && market.length >= 5 && market[4]) {
          showInfo('This market is already enabled')
          setIsLoadingAddMarket(false)
          return
        }
      } catch {
        // Market doesn't exist, continue
      }
      
      // Reserve factor is in basis points (e.g., 1000 = 10%)
      const reserveFactorValue = BigInt(reserveFactor)
      const tx = await lendingPool.addMarket(newMarketToken, reserveFactorValue)
      console.log('Add market transaction sent:', tx.hash)
      const receipt = await tx.wait()
      console.log('Market added in block:', receipt.blockNumber)
      
      showSuccess('Market added successfully!')
      setNewMarketToken('')
      setReserveFactor('1000')
    } catch (error: any) {
      console.error('Add market error:', error)
      let errorMessage = error.reason || error.message || 'Failed to add market'
      
      if (error.message?.includes('OwnableUnauthorizedAccount') || error.message?.includes('not the owner')) {
        errorMessage = 'Only the contract owner can add markets'
      } else if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingRepay(false)
    }
  }

  const loadBalances = async () => {
    if (!tokenAddress || !account) return
    
    try {
      const lendingPool = await getLendingPool()
      const collateralManager = await getCollateralManager()
      
      // Get token decimals for proper formatting
      let tokenDecimals = 18
      try {
        const token = getERC20(tokenAddress)
        tokenDecimals = await token.decimals()
      } catch {
        tokenDecimals = 18
      }
      
      const deposit = await lendingPool.getDepositBalance(account, tokenAddress)
      const borrow = await lendingPool.getBorrowBalance(account, tokenAddress)
      const max = await collateralManager.getMaxBorrow(account)
      
      setDepositBalance(ethers.formatUnits(deposit, tokenDecimals))
      setBorrowBalance(ethers.formatUnits(borrow, tokenDecimals))
      setMaxBorrow(ethers.formatUnits(max, tokenDecimals))
    } catch (error) {
      console.error('Error loading balances:', error)
    }
  }

  const loadAllDepositsAndCollaterals = async () => {
    if (!account) {
      setDepositedAssets([])
      setDepositedCollaterals([])
      return
    }

    setIsLoadingPortfolio(true)
    try {
      const lendingPool = await getLendingPool()
      const collateralManager = await getCollateralManager()
      
      const deposits: DepositInfo[] = []
      const collaterals: DepositInfo[] = []
      
      // Check all known tokens plus any custom tokens user might have
      const tokensToCheck = [...TOKENS]
      
      // Also check the currently selected token if it's not in the list
      if (tokenAddress && !tokensToCheck.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())) {
        try {
          const token = getERC20(tokenAddress)
          const decimals = await token.decimals()
          let symbol = 'UNKNOWN'
          let name = 'Unknown Token'
          try {
            symbol = await token.symbol()
            name = await token.name()
          } catch {}
          tokensToCheck.push({
            address: tokenAddress,
            symbol,
            name,
            decimals,
          })
        } catch {}
      }
      
      // Check deposits and collaterals for each token
      for (const token of tokensToCheck) {
        try {
          // Check deposit balance
          const depositBalance = await lendingPool.getDepositBalance(account, token.address)
          if (depositBalance > 0n) {
            deposits.push({
              tokenAddress: token.address,
              tokenSymbol: token.symbol,
              tokenName: token.name,
              amount: ethers.formatUnits(depositBalance, token.decimals),
              decimals: token.decimals,
            })
          }
          
          // Check collateral balance
          const collateralBalance = await collateralManager.collateralBalances(account, token.address)
          if (collateralBalance > 0n) {
            collaterals.push({
              tokenAddress: token.address,
              tokenSymbol: token.symbol,
              tokenName: token.name,
              amount: ethers.formatUnits(collateralBalance, token.decimals),
              decimals: token.decimals,
            })
          }
        } catch (error) {
          // Token might not be enabled or might have issues, skip it
          console.warn(`Error checking ${token.symbol}:`, error)
        }
      }
      
      setDepositedAssets(deposits)
      setDepositedCollaterals(collaterals)
    } catch (error) {
      console.error('Error loading deposits and collaterals:', error)
      setDepositedAssets([])
      setDepositedCollaterals([])
    } finally {
      setIsLoadingPortfolio(false)
    }
  }

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const handleDeposit = async () => {
    if (!depositAmount || !tokenAddress) {
      showWarning('Please enter an amount and select a token')
      return
    }
    
    if (!ethers.isAddress(tokenAddress)) {
      showError('Invalid token address. Please select a valid token.')
      return
    }
    
    setIsLoadingDeposit(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      // Get token instance
      const token = await getERC20WithSigner(tokenAddress)
      
      // Check if depositing as collateral or into pool
      if (depositAsCollateral) {
        // Deposit as collateral
        const collateralManager = await getCollateralManager()
        
        // Get token decimals
        let tokenDecimals = 18
        try {
          tokenDecimals = await token.decimals()
        } catch (error: any) {
          try {
            await token.balanceOf(account)
            console.warn('Token decimals() not available, using default 18')
          } catch (balanceError: any) {
            throw new Error('Invalid token address. Unable to interact with token contract. Please verify the address is correct.')
          }
        }
        
        const amount = ethers.parseUnits(depositAmount, tokenDecimals)
        
        // Check if token has balance
        try {
          const balance = await token.balanceOf(account)
          if (balance < amount) {
            const formattedBalance = ethers.formatUnits(balance, tokenDecimals)
            throw new Error(`Insufficient balance. You have ${formattedBalance} tokens.`)
          }
        } catch (error: any) {
          if (error.message.includes('Insufficient balance')) {
            throw error
          }
          throw new Error('Unable to check token balance. Please verify the token address is correct.')
        }
        
        // Check allowance
        let allowance
        try {
          allowance = await token.allowance(account, await collateralManager.getAddress())
        } catch (error: any) {
          throw new Error('Unable to check token allowance. This may not be a valid ERC20 token.')
        }
        
        if (allowance < amount) {
          const approveTx = await token.approve(await collateralManager.getAddress(), amount)
          await approveTx.wait()
        }
        
        const tx = await collateralManager.depositCollateral(tokenAddress, amount)
        await tx.wait()
        showSuccess('Collateral deposited!')
        setDepositAmount('')
        loadBalances()
        loadAllDepositsAndCollaterals()
        return
      }
      
      // Deposit into pool
      const lendingPool = await getLendingPool()
      
      // Get token decimals - this validates the token is ERC20 compatible
      // Special handling for USDC ERC-20 interface
      const isUSDC = tokenAddress.toLowerCase() === '0x3600000000000000000000000000000000000000'
      let tokenDecimals = isUSDC ? 6 : 18
      
      // Try to get decimals, but don't fail if it doesn't work
      try {
        const decimalsResult = await token.decimals()
        tokenDecimals = Number(decimalsResult)
        console.log('Token decimals:', tokenDecimals)
      } catch (error: any) {
        console.warn('decimals() failed, using default:', error.message)
        // For USDC, we know it's 6 decimals, so use that
        // For others, try balanceOf as validation
        if (!isUSDC) {
          try {
            const balance = await token.balanceOf(account)
            console.log('balanceOf() succeeded, balance:', balance.toString())
            // If balanceOf works, token is valid
          } catch (balanceError: any) {
            console.error('balanceOf() also failed:', balanceError.message)
            // Still proceed - the actual deposit will fail if token is invalid
            console.warn('Proceeding with deposit attempt - will fail if token is invalid')
          }
        }
      }
      
      // Check if market is added to the lending pool (optional check)
      try {
        const market = await lendingPool.markets(tokenAddress)
        console.log('Market info:', market)
        // Market struct: [token, totalDeposits, totalBorrows, reserveFactor, enabled]
        if (market && Array.isArray(market) && market.length >= 5 && !market[4]) {
          throw new Error('This token market is not enabled in the lending pool. Please add the market first.')
        }
      } catch (error: any) {
        if (error.message.includes('not enabled')) {
          throw error
        }
        // Market check failed - might be because market doesn't exist yet
        // Continue anyway - the deposit will fail with a clearer error if market doesn't exist
        console.warn('Could not check market status (market may not exist yet):', error.message)
      }
      
      const amount = ethers.parseUnits(depositAmount, tokenDecimals)
      
      // Check if token has balance
      try {
        const balance = await token.balanceOf(account)
        if (balance < amount) {
          const formattedBalance = ethers.formatUnits(balance, tokenDecimals)
          throw new Error(`Insufficient balance. You have ${formattedBalance} tokens.`)
        }
      } catch (error: any) {
        if (error.message.includes('Insufficient balance')) {
          throw error
        }
        // Don't fail on balance check - let the actual transaction fail if needed
        console.warn('Could not check balance, proceeding:', error.message)
      }
      
      // Check allowance - handle gracefully if it fails
      let allowance = 0n
      try {
        allowance = await token.allowance(account, await lendingPool.getAddress())
        console.log('Current allowance:', allowance.toString())
      } catch (error: any) {
        console.warn('allowance() failed, will attempt approval anyway:', error.message)
        // For USDC ERC-20 interface or other special tokens, allowance might not work
        // Try to proceed anyway - the approve will fail if it doesn't work
        allowance = 0n // Set to 0 to force approval attempt
      }
      
      if (allowance < amount) {
        console.log('Approving token...')
        try {
          const lendingPoolAddress = await lendingPool.getAddress()
          console.log('Approving', tokenAddress, 'for', lendingPoolAddress, 'amount:', amount.toString())
          const approveTx = await token.approve(lendingPoolAddress, amount)
          console.log('Approval transaction sent:', approveTx.hash)
          const receipt = await approveTx.wait()
          console.log('Approval confirmed in block:', receipt.blockNumber)
        } catch (approveError: any) {
          console.error('Approval failed:', approveError)
          // Provide helpful error message
          if (approveError.message?.includes('user rejected') || approveError.code === 4001) {
            throw new Error('Transaction was rejected. Please approve the transaction in your wallet.')
          }
          throw new Error(`Token approval failed: ${approveError.message || approveError.reason || 'Unknown error'}. Make sure you have sufficient balance and the token supports approve().`)
        }
      }
      
      console.log('Depositing', amount.toString(), 'of token', tokenAddress)
      const tx = await lendingPool.deposit(tokenAddress, amount)
      console.log('Deposit transaction sent:', tx.hash)
      const receipt = await tx.wait()
      console.log('Deposit confirmed in block:', receipt.blockNumber)
      showSuccess('Deposit successful!')
      setDepositAmount('')
      loadBalances()
      loadAllDepositsAndCollaterals()
    } catch (error: any) {
      console.error('Deposit error:', error)
      
      // Provide more helpful error messages
      let errorMessage = error.reason || error.message || 'Deposit failed'
      
      if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected. Please approve the transaction in your wallet.'
      } else if (error.message?.includes('Market not enabled')) {
        errorMessage = 'This token market is not enabled. Please add the market first or use a different token.'
      } else if (error.message?.includes('Insufficient')) {
        errorMessage = error.message
      } else if (error.message?.includes('allowance') || error.message?.includes('approve')) {
        errorMessage = `Token approval issue: ${error.message}. Make sure the token supports approve() and you have sufficient balance.`
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingDeposit(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || !tokenAddress) {
      showWarning('Please enter an amount and select a token')
      return
    }
    
    if (!ethers.isAddress(tokenAddress)) {
      showError('Invalid token address. Please select a valid token.')
      return
    }
    
    setIsLoadingWithdraw(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      // Get token decimals
      let tokenDecimals = 18
      try {
        const token = getERC20(tokenAddress)
        tokenDecimals = await token.decimals()
      } catch (error: any) {
        try {
          const token = getERC20(tokenAddress)
          await token.balanceOf(account)
          console.warn('Token decimals() not available, using default 18')
        } catch (balanceError: any) {
          throw new Error('Invalid token address. Unable to interact with token contract.')
        }
      }
      
      const amount = ethers.parseUnits(withdrawAmount, tokenDecimals)
      
      // Check if withdrawing from collateral or pool
      if (withdrawFromCollateral) {
        // Withdraw from collateral
        const collateralManager = await getCollateralManager()
        
        // Check if user has enough collateral balance
        try {
          const collateralBalance = await collateralManager.collateralBalances(account, tokenAddress)
          if (collateralBalance < amount) {
            const formattedBalance = ethers.formatUnits(collateralBalance, tokenDecimals)
            throw new Error(`Insufficient collateral balance. You have ${formattedBalance} tokens available to withdraw.`)
          }
        } catch (error: any) {
          if (error.message.includes('Insufficient collateral balance')) {
            throw error
          }
          throw new Error('Unable to check collateral balance. Please verify the token address is correct.')
        }
        
        const tx = await collateralManager.withdrawCollateral(tokenAddress, amount)
        console.log('Withdraw collateral transaction sent:', tx.hash)
        const receipt = await tx.wait()
        console.log('Collateral withdrawal confirmed in block:', receipt.blockNumber)
        showSuccess('Collateral withdrawal successful!')
        setWithdrawAmount('')
        loadBalances()
        loadAllDepositsAndCollaterals()
        return
      }
      
      // Withdraw from pool
      const lendingPool = await getLendingPool()
      
      // Check if user has enough deposit balance
      try {
        const depositBalance = await lendingPool.getDepositBalance(account, tokenAddress)
        if (depositBalance < amount) {
          const formattedBalance = ethers.formatUnits(depositBalance, tokenDecimals)
          throw new Error(`Insufficient deposit balance. You have ${formattedBalance} tokens available to withdraw.`)
        }
      } catch (error: any) {
        if (error.message.includes('Insufficient deposit balance')) {
          throw error
        }
        console.warn('Could not check deposit balance, proceeding:', error.message)
      }
      
      const tx = await lendingPool.withdraw(tokenAddress, amount)
      console.log('Withdraw transaction sent:', tx.hash)
      const receipt = await tx.wait()
      console.log('Withdrawal confirmed in block:', receipt.blockNumber)
      showSuccess('Withdrawal successful!')
      setWithdrawAmount('')
      loadBalances()
      loadAllDepositsAndCollaterals()
    } catch (error: any) {
      console.error('Withdraw error:', error)
      let errorMessage = error.reason || error.message || 'Withdrawal failed'
      
      if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected. Please approve the transaction in your wallet.'
      } else if (error.message?.includes('Insufficient')) {
        errorMessage = error.message
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingWithdraw(false)
    }
  }

  const handleBorrow = async () => {
    if (!borrowAmount || !tokenAddress) {
      showWarning('Please enter an amount and select a token')
      return
    }
    
    setIsLoadingBorrow(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const lendingPool = await getLendingPool()
      const collateralManager = await getCollateralManager()
      
      // Get token decimals
      let tokenDecimals = 18
      try {
        const token = getERC20(tokenAddress)
        tokenDecimals = await token.decimals()
      } catch {
        tokenDecimals = 18
      }
      
      // Get current borrow balance and max borrow
      // Note: We need to re-fetch right before the transaction because interest accrues
      // in the contract before the borrow limit check, which can increase the borrow balance
      const currentBorrow = await lendingPool.getBorrowBalance(account, tokenAddress)
      const maxBorrowWei = await collateralManager.getMaxBorrow(account)
      
      // Parse the requested borrow amount
      const requestedAmount = ethers.parseUnits(borrowAmount, tokenDecimals)
      
      // Add a small buffer (1%) to account for interest accrual that happens in the contract
      // The contract accrues interest before checking the limit, which can increase currentBorrow
      const buffer = maxBorrowWei / 100n // 1% buffer
      const adjustedMaxBorrow = maxBorrowWei > buffer ? maxBorrowWei - buffer : maxBorrowWei
      
      // Check if borrow would exceed limit (with buffer)
      const totalBorrowAfter = currentBorrow + requestedAmount
      if (totalBorrowAfter > adjustedMaxBorrow) {
        const currentBorrowFormatted = ethers.formatUnits(currentBorrow, tokenDecimals)
        const maxBorrowFormatted = ethers.formatUnits(maxBorrowWei, tokenDecimals)
        const availableToBorrow = adjustedMaxBorrow > currentBorrow ? adjustedMaxBorrow - currentBorrow : 0n
        const availableFormatted = ethers.formatUnits(availableToBorrow, tokenDecimals)
        
        throw new Error(
          `Borrow amount exceeds limit. ` +
          `Current borrow: ${currentBorrowFormatted}, ` +
          `Max borrow: ${maxBorrowFormatted}, ` +
          `Available to borrow: ${availableFormatted} (with 1% buffer for interest accrual). ` +
          `Please deposit more collateral or reduce the borrow amount.`
        )
      }
      
      // Check if market has sufficient liquidity
      const market = await lendingPool.markets(tokenAddress)
      if (!market || !(Array.isArray(market) && market.length >= 5 && market[4])) {
        throw new Error('This token market is not enabled. Please contact admin to add the market.')
      }
      
      const amount = ethers.parseUnits(borrowAmount, tokenDecimals)
      
      // Debug: Log market state before borrow
      const marketTotalDeposits = BigInt(market[1].toString())
      const marketTotalBorrows = BigInt(market[2].toString())
      const availableBeforeInterest = marketTotalDeposits > marketTotalBorrows 
        ? marketTotalDeposits - marketTotalBorrows
        : 0n
      
      console.log('Market state before borrow:', {
        tokenAddress,
        totalDeposits: market[1].toString(),
        totalBorrows: market[2].toString(),
        requestedAmount: amount.toString(),
        availableBeforeInterest: availableBeforeInterest.toString(),
        requiredAfterBorrow: (marketTotalBorrows + amount).toString()
      })
      
      // The contract accrues interest BEFORE checking liquidity, which increases totalBorrows
      // This means even if availableBeforeInterest >= amount, the check might fail after interest accrual
      // We'll let the contract handle it, but provide detailed error info if it fails
      
      try {
        const tx = await lendingPool.borrow(tokenAddress, amount)
        console.log('Borrow transaction sent:', tx.hash)
        const receipt = await tx.wait()
        console.log('Borrow confirmed in block:', receipt.blockNumber)
        showSuccess('Borrow successful!')
        setBorrowAmount('')
        loadBalances()
        loadAllDepositsAndCollaterals()
      } catch (borrowError: any) {
        // Re-throw to be caught by outer catch
        throw borrowError
      }
    } catch (error: any) {
      console.error('Borrow error:', error)
      
      // If it's an insufficient liquidity error, provide detailed information
      if (error.message?.includes('Insufficient liquidity') || error.reason === 'Insufficient liquidity') {
        try {
          // Get token decimals
          let tokenDecimals = 18
          try {
            const tokenContract = getERC20(tokenAddress)
            const decimals = await tokenContract.decimals()
            tokenDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
          } catch {
            // Default to 18
          }
          
          const requestedAmount = ethers.parseUnits(borrowAmount || '0', tokenDecimals)
          const lendingPool = await getLendingPool()
          const market = await lendingPool.markets(tokenAddress)
          const marketTotalDeposits = Array.isArray(market) ? market[1] : market.totalDeposits || 0n
          const marketTotalBorrows = Array.isArray(market) ? market[2] : market.totalBorrows || 0n
          const formattedTotalDeposits = ethers.formatUnits(marketTotalDeposits, tokenDecimals)
          const formattedTotalBorrows = ethers.formatUnits(marketTotalBorrows, tokenDecimals)
          const formattedRequested = ethers.formatUnits(requestedAmount, tokenDecimals)
          const availableLiquidity = marketTotalDeposits > marketTotalBorrows 
            ? ethers.formatUnits(marketTotalDeposits - marketTotalBorrows, tokenDecimals)
            : '0'
          
          const tokenName = tokenAddress === '0x3600000000000000000000000000000000000000' ? 'USDC' : 
                           tokenAddress === '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' ? 'EURC' : 'token'
          
          const errorMessage = 
            `Insufficient liquidity in the ${tokenName} market.\n\n` +
            `Requested: ${formattedRequested}\n` +
            `Available: ~${availableLiquidity} (before interest accrual)\n` +
            `Total deposits: ${formattedTotalDeposits}\n` +
            `Total borrows: ${formattedTotalBorrows}\n\n` +
            `⚠️ Important: Collateral deposits don't add liquidity to the pool!\n\n` +
            `To borrow, someone needs to deposit ${tokenName} into the pool (not as collateral). ` +
            `Use the "Deposit" section above and make sure "Enable collateral" is NOT checked. ` +
            `This adds liquidity that can be borrowed by anyone with sufficient collateral.`
          
          showError(errorMessage)
          return
        } catch (debugError) {
          console.error('Error getting market info for error message:', debugError)
        }
      }
      
      let errorMessage = error.reason || error.message || 'Borrow failed. Make sure you have sufficient collateral.'
      
      if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      } else if (error.message?.includes('Exceeds borrow limit') || error.message?.includes('exceeds limit')) {
        errorMessage = error.message
      } else if (error.message?.includes('Insufficient liquidity') || error.reason === 'Insufficient liquidity') {
        errorMessage = 'Pool has insufficient liquidity. The contract accrues interest before checking, which may reduce available liquidity. Try a smaller amount or ensure there are deposits in the pool.'
      } else if (error.message?.includes('Market not enabled')) {
        errorMessage = 'This token market is not enabled. Please contact admin to add the market.'
      }
      
      showError(errorMessage)
    } finally {
      setIsLoadingBorrow(false)
    }
  }

  const handleRepay = async () => {
    if (!repayAmount || !tokenAddress) {
      showWarning('Please enter an amount and select a token')
      return
    }
    
    if (!ethers.isAddress(tokenAddress)) {
      showError('Invalid token address. Please select a valid token.')
      return
    }
    
    setIsLoadingRepay(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      // Get token instance and validate
      const token = await getERC20WithSigner(tokenAddress)
      const lendingPool = await getLendingPool()
      
      // Get token decimals - this validates the token is ERC20 compatible
      let tokenDecimals = 18
      try {
        tokenDecimals = await token.decimals()
      } catch (error: any) {
        // If decimals() fails, try balanceOf() to validate token exists
        try {
          await token.balanceOf(account)
          console.warn('Token decimals() not available, using default 18')
        } catch (balanceError: any) {
          throw new Error('Invalid token address. Unable to interact with token contract. Please verify the address is correct.')
        }
      }
      
      const amount = ethers.parseUnits(repayAmount, tokenDecimals)
      
      // Get current borrow balance to ensure we don't repay more than owed
      // The contract accrues interest before repay, which increases the balance
      // We need to add a small buffer to account for this
      const currentBorrowBalance = await lendingPool.getBorrowBalance(account, tokenAddress)
      
      if (currentBorrowBalance === 0n) {
        throw new Error('You have no outstanding borrows for this token.')
      }
      
      // Add a small buffer (0.5%) to account for interest accrual that happens in the contract
      // This prevents overflow errors when the contract accrues interest before checking
      const buffer = currentBorrowBalance / 200n // 0.5% buffer
      const maxRepayable = currentBorrowBalance > buffer ? currentBorrowBalance - buffer : currentBorrowBalance
      
      // Cap the repay amount to prevent overflow
      // The contract will handle this, but we do it here to prevent the error
      const repayAmountCapped = amount > maxRepayable ? maxRepayable : amount
      
      if (repayAmountCapped === 0n) {
        throw new Error('Repay amount must be greater than 0.')
      }
      
      // Check if token has balance
      try {
        const balance = await token.balanceOf(account)
        if (balance < repayAmountCapped) {
          const formattedBalance = ethers.formatUnits(balance, tokenDecimals)
          const formattedBorrow = ethers.formatUnits(currentBorrowBalance, tokenDecimals)
          throw new Error(`Insufficient balance. You have ${formattedBalance} tokens, but owe ${formattedBorrow}.`)
        }
      } catch (error: any) {
        if (error.message.includes('Insufficient balance')) {
          throw error
        }
        throw new Error('Unable to check token balance. Please verify the token address is correct.')
      }
      
      // Check allowance
      let allowance
      try {
        allowance = await token.allowance(account, await lendingPool.getAddress())
      } catch (error: any) {
        throw new Error('Unable to check token allowance. This may not be a valid ERC20 token.')
      }
      
      if (allowance < repayAmountCapped) {
        const approveTx = await token.approve(await lendingPool.getAddress(), repayAmountCapped)
        await approveTx.wait()
      }
      
      const tx = await lendingPool.repay(tokenAddress, repayAmountCapped)
      await tx.wait()
      showSuccess('Repay successful!')
      setRepayAmount('')
      loadBalances()
    } catch (error: any) {
      console.error('Repay error:', error)
      const errorMessage = error.reason || error.message || 'Repay failed'
      showError(errorMessage)
    } finally {
      setIsLoadingRepay(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* TVL Stats Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl shadow-sm p-6 border border-blue-200 dark:border-blue-800"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <TrendingUp className="h-5 w-5 icon-gradient icon-glow" />
            </motion.div>
            <span>Total Value Locked (TVL)</span>
          </h3>
          {isLoadingTvl && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        </div>
        
        {tvlStats.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tvlStats.map((stat, index) => (
              <motion.div
                key={stat.token}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 card-entrance button-lift"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{stat.symbol}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Pool Deposits</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {stat.totalDeposits}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Borrowed: {stat.totalBorrows} {stat.symbol}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Available: {(parseFloat(stat.totalDeposits) - parseFloat(stat.totalBorrows)).toFixed(2)} {stat.symbol}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-slate-500 dark:text-slate-400">
            {isLoadingTvl ? 'Loading TVL stats...' : 'No deposits in the pool yet. Be the first to deposit!'}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6"
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <DollarSign className="h-6 w-6 icon-gradient icon-glow" />
          </motion.div>
          <span>Lending Protocol</span>
        </h2>

        {/* Token Selector */}
        <div className="mb-6">
          <TokenSelector
            value={tokenAddress}
            onChange={setTokenAddress}
            label="Select Token"
            showCustomInput={true}
          />
          {tokenAddress && <TokenInfo address={tokenAddress} />}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <div className="text-sm text-slate-900 dark:text-white/80">Deposit Balance</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{depositBalance}</div>
            <div className="text-xs text-slate-900 dark:text-white/70 mt-1">
              {tokenAddress ? `For selected token` : 'Select a token'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <div className="text-sm text-slate-900 dark:text-white/80">Borrow Balance</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{borrowBalance}</div>
            <div className="text-xs text-slate-900 dark:text-white/70 mt-1">
              {tokenAddress ? `For selected token` : 'Select a token'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <div className="text-sm text-slate-900 dark:text-white/80">Max Borrow</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{maxBorrow}</div>
            <div className="text-xs text-slate-900 dark:text-white/70 mt-1">Based on collateral</div>
          </div>
        </div>

        {/* My Deposits and Collaterals */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>My Portfolio</span>
            </h3>
            <button
              onClick={loadAllDepositsAndCollaterals}
              disabled={isLoadingPortfolio || !account}
              className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoadingPortfolio ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposited Assets */}
            <div>
              <h4 className="text-md font-medium text-slate-900 dark:text-white/90 mb-3 flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>Deposited Assets</span>
              </h4>
              {!account ? (
                <p className="text-sm text-slate-900 dark:text-white/70 text-center py-4">
                  Please connect your wallet
                </p>
              ) : depositedAssets.length === 0 ? (
                <p className="text-sm text-slate-900 dark:text-white/70 text-center py-4">
                  No deposits found
                </p>
              ) : (
                <div className="space-y-2">
                  {depositedAssets.map((deposit, index) => (
                    <div
                      key={`deposit-${deposit.tokenAddress}-${index}`}
                      className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-300 dark:border-slate-600"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {deposit.tokenSymbol}
                          </div>
                          <div className="text-xs text-slate-900 dark:text-white/70">
                            {deposit.tokenName}
                          </div>
                          <div className="text-xs text-slate-900 dark:text-white/60 font-mono mt-1">
                            {formatAddress(deposit.tokenAddress)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {deposit.amount}
                          </div>
                          <button
                            onClick={() => {
                              setTokenAddress(deposit.tokenAddress)
                              setWithdrawAmount(deposit.amount)
                            }}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1"
                          >
                            Use for withdraw
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deposited Collaterals */}
            <div>
              <h4 className="text-md font-medium text-slate-900 dark:text-white/90 mb-3 flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Deposited Collaterals</span>
              </h4>
              {!account ? (
                <p className="text-sm text-slate-900 dark:text-white/70 text-center py-4">
                  Please connect your wallet
                </p>
              ) : depositedCollaterals.length === 0 ? (
                <p className="text-sm text-slate-900 dark:text-white/70 text-center py-4">
                  No collaterals found
                </p>
              ) : (
                <div className="space-y-2">
                  {depositedCollaterals.map((collateral, index) => (
                    <div
                      key={`collateral-${collateral.tokenAddress}-${index}`}
                      className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-300 dark:border-slate-600"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {collateral.tokenSymbol}
                          </div>
                          <div className="text-xs text-slate-900 dark:text-white/70">
                            {collateral.tokenName}
                          </div>
                          <div className="text-xs text-slate-900 dark:text-white/60 font-mono mt-1">
                            {formatAddress(collateral.tokenAddress)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {collateral.amount}
                          </div>
                          <button
                            onClick={() => {
                              setTokenAddress(collateral.tokenAddress)
                            }}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1"
                          >
                            View details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Deposit */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <TrendingUp className="h-5 w-5 icon-gradient" />
              </motion.div>
              <span>Deposit</span>
            </h3>
            <div className="flex space-x-2">
              <input
                type="number"
                step="0.001"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Amount"
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={async () => {
                  if (!tokenAddress || !account) {
                    showWarning('Please select a token first')
                    return
                  }
                  try {
                    // Get token instance
                    const token = getERC20(tokenAddress)
                    
                    // Get token decimals
                    let tokenDecimals = 18
                    try {
                      const decimals = await token.decimals()
                      tokenDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals
                    } catch {
                      // Default to 18, or 6 for USDC
                      const isUSDC = tokenAddress.toLowerCase() === '0x3600000000000000000000000000000000000000'
                      tokenDecimals = isUSDC ? 6 : 18
                    }
                    
                    // Get user's wallet balance
                    const balance = await token.balanceOf(account)
                    
                    if (balance === 0n) {
                      showInfo('You have no balance of this token in your wallet.')
                      return
                    }
                    
                    // Format the balance
                    const balanceFormatted = ethers.formatUnits(balance, tokenDecimals)
                    
                    // Round down to 3 decimal places to prevent precision issues
                    const amountAsNumber = parseFloat(balanceFormatted)
                    const roundedDown = Math.floor(amountAsNumber * 1000) / 1000
                    
                    if (roundedDown <= 0) {
                      showInfo('Balance is too small to deposit (less than 0.001).')
                      return
                    }
                    
                    // Format to exactly 3 decimal places
                    const roundedString = roundedDown.toFixed(3)
                    setDepositAmount(roundedString)
                  } catch (error: any) {
                    console.error('Error getting max deposit:', error)
                    showWarning(`Unable to calculate max deposit: ${error.message || 'Unknown error'}. Please enter amount manually.`)
                  }
                }}
                className="px-3 py-2 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                title="Set to maximum wallet balance"
              >
                Max
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="depositAsCollateral"
                checked={depositAsCollateral}
                onChange={(e) => setDepositAsCollateral(e.target.checked)}
                className="w-4 h-4 text-primary-600 bg-slate-100 border-slate-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
              />
              <label
                htmlFor="depositAsCollateral"
                className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
              >
                Enable collateral
              </label>
            </div>
            <button
              onClick={handleDeposit}
              disabled={isLoadingDeposit || !depositAmount}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingDeposit && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{depositAsCollateral ? 'Deposit as Collateral' : 'Deposit'}</span>
            </button>
          </div>

          {/* Withdraw */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Withdraw</h3>
            <div className="flex space-x-2">
              <input
                type="number"
                step="0.001"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount"
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={async () => {
                  if (!tokenAddress || !account) {
                    showWarning('Please select a token first')
                    return
                  }
                  try {
                    // Get token decimals
                    let tokenDecimals = 18
                    try {
                      const token = getERC20(tokenAddress)
                      tokenDecimals = await token.decimals()
                    } catch {
                      tokenDecimals = 18
                    }
                    
                    if (withdrawFromCollateral) {
                      // Get collateral balance
                      const collateralManager = await getCollateralManager()
                      const currentCollateralBalance = await collateralManager.collateralBalances(account, tokenAddress)
                      
                      if (currentCollateralBalance === 0n) {
                        showInfo('You have no collateral for this token.')
                        return
                      }
                      
                      // Format the balance and round down to avoid precision errors
                      const maxWithdrawAmountFormatted = ethers.formatUnits(currentCollateralBalance, tokenDecimals)
                      const amountAsNumber = parseFloat(maxWithdrawAmountFormatted)
                      
                      // Round down to 3 decimal places to prevent "Insufficient balance" errors
                      // Example: 2.00001 -> Math.floor(2.00001 * 1000) / 1000 = 2.0
                      const roundedDown = Math.floor(amountAsNumber * 1000) / 1000
                      
                      if (roundedDown <= 0) {
                        showInfo('Collateral balance is too small to withdraw (less than 0.001).')
                        return
                      }
                      
                      // Format to exactly 3 decimal places
                      const roundedString = roundedDown.toFixed(3)
                      setWithdrawAmount(roundedString)
                    } else {
                      // Get deposit balance
                      const lendingPool = await getLendingPool()
                      const currentDepositBalance = await lendingPool.getDepositBalance(account, tokenAddress)
                      
                      if (currentDepositBalance === 0n) {
                        showInfo('You have no deposits for this token.')
                        return
                      }
                      
                      // Format the balance and round down to avoid precision errors
                      const maxWithdrawAmountFormatted = ethers.formatUnits(currentDepositBalance, tokenDecimals)
                      const amountAsNumber = parseFloat(maxWithdrawAmountFormatted)
                      
                      // Round down to 3 decimal places to prevent "Insufficient balance" errors
                      // Example: 2.00001 -> Math.floor(2.00001 * 1000) / 1000 = 2.0
                      const roundedDown = Math.floor(amountAsNumber * 1000) / 1000
                      
                      if (roundedDown <= 0) {
                        showInfo('Deposit balance is too small to withdraw (less than 0.001).')
                        return
                      }
                      
                      // Format to exactly 3 decimal places
                      const roundedString = roundedDown.toFixed(3)
                      setWithdrawAmount(roundedString)
                    }
                  } catch (error: any) {
                    console.error('Error getting max withdraw:', error)
                    showWarning(`Unable to calculate max withdraw: ${error.message || 'Unknown error'}. Please enter amount manually.`)
                  }
                }}
                className="px-3 py-2 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                title={withdrawFromCollateral ? "Set to maximum withdrawable collateral amount" : "Set to maximum withdrawable amount (your deposit balance)"}
              >
                Max
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="withdrawFromCollateral"
                checked={withdrawFromCollateral}
                onChange={(e) => setWithdrawFromCollateral(e.target.checked)}
                className="w-4 h-4 text-primary-600 bg-slate-100 border-slate-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
              />
              <label
                htmlFor="withdrawFromCollateral"
                className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
              >
                Withdraw from collateral
              </label>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={isLoadingWithdraw || !withdrawAmount}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingWithdraw && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{withdrawFromCollateral ? 'Withdraw Collateral' : 'Withdraw'}</span>
            </button>
          </div>

          {/* Borrow */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Borrow</h3>
            </div>
            <div className="flex space-x-2">
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                placeholder="Amount"
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={async () => {
                  if (!tokenAddress || !account) {
                    showWarning('Please select a token first')
                    return
                  }
                  try {
                    const lendingPool = await getLendingPool()
                    const collateralManager = await getCollateralManager()
                    
                    // Get token decimals
                    let tokenDecimals = 18
                    try {
                      const token = getERC20(tokenAddress)
                      tokenDecimals = await token.decimals()
                    } catch {
                      tokenDecimals = 18
                    }
                    
                    // 1. Get max borrow based on collateral (75% LTV)
                    const currentBorrow = await lendingPool.getBorrowBalance(account, tokenAddress)
                    const maxBorrowWei = await collateralManager.getMaxBorrow(account)
                    const availableFromCollateral = maxBorrowWei > currentBorrow ? maxBorrowWei - currentBorrow : 0n
                    
                    // 2. Get available liquidity in the pool for this token
                    const market = await lendingPool.markets(tokenAddress)
                    if (!market || !(Array.isArray(market) && market.length >= 5 && market[4])) {
                      showError('This token market is not enabled. Please contact admin to add the market.')
                      return
                    }
                    
                    // Available liquidity = totalDeposits - totalBorrows (before interest accrual)
                    // The contract accrues interest before checking, so we add a small buffer
                    const totalDeposits = BigInt(market[1].toString())
                    const totalBorrows = BigInt(market[2].toString())
                    const availableLiquidityInPool: bigint = totalDeposits > totalBorrows 
                      ? totalDeposits - totalBorrows
                      : 0n
                    
                    // Add a small buffer (2%) to account for interest accrual that increases totalBorrows
                    const liquidityBuffer = availableLiquidityInPool > 0n 
                      ? availableLiquidityInPool / 50n // 2% buffer
                      : 0n
                    const availableLiquidityWithBuffer = availableLiquidityInPool > liquidityBuffer
                      ? availableLiquidityInPool - liquidityBuffer
                      : availableLiquidityInPool
                    
                    // 3. The actual max borrowable is the minimum of:
                    //    - Available from collateral (maxBorrow - currentBorrow)
                    //    - Available liquidity in pool (with buffer for interest)
                    const maxBorrowable = availableFromCollateral < availableLiquidityWithBuffer
                      ? availableFromCollateral
                      : availableLiquidityWithBuffer
                    
                    if (maxBorrowable === 0n) {
                      if (availableFromCollateral === 0n) {
                        showWarning('No available borrow capacity based on your collateral. Please deposit more collateral.')
                      } else {
                        const availableLiquidityFormatted = ethers.formatUnits(availableLiquidityInPool, tokenDecimals)
                        showError(
                          `No available liquidity in the pool for this token.\n\n` +
                          `Pool liquidity: ${availableLiquidityFormatted}\n` +
                          `Your collateral capacity: ${ethers.formatUnits(availableFromCollateral, tokenDecimals)}\n\n` +
                          `Important: Collateral deposits don't add liquidity to the pool. ` +
                          `To borrow, someone needs to deposit into the pool (not as collateral). ` +
                          `Use the "Deposit" section (without "Enable collateral" checked) to add liquidity to the pool.`
                        )
                      }
                      return
                    }
                    
                    const maxAmount = ethers.formatUnits(maxBorrowable, tokenDecimals)
                    setBorrowAmount(maxAmount)
                  } catch (error: any) {
                    console.error('Error getting max borrow:', error)
                    showWarning('Unable to calculate max borrow. Please enter amount manually.')
                  }
                }}
                className="px-3 py-2 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                title="Set to maximum available borrow amount"
              >
                Max
              </button>
            </div>
            {maxBorrow !== '0' && tokenAddress && (
              <div className="text-xs text-slate-900 dark:text-white/70">
                Max borrow: {maxBorrow} (based on your collateral)
              </div>
            )}
            <button
              onClick={handleBorrow}
              disabled={isLoadingBorrow || !borrowAmount}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingBorrow && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Borrow</span>
            </button>
          </div>

          {/* Repay */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Repay</h3>
            <div className="flex space-x-2">
              <input
                type="number"
                step="0.001"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="Amount"
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={async () => {
                  if (!tokenAddress || !account) {
                    showWarning('Please select a token first')
                    return
                  }
                  try {
                    const lendingPool = await getLendingPool()
                    
                    // Get token decimals
                    let tokenDecimals = 18
                    try {
                      const token = getERC20(tokenAddress)
                      tokenDecimals = await token.decimals()
                    } catch {
                      tokenDecimals = 18
                    }
                    
                    // Get current borrow balance (includes accrued interest)
                    const currentBorrowBalance = await lendingPool.getBorrowBalance(account, tokenAddress)
                    
                    if (currentBorrowBalance === 0n) {
                      showInfo('You have no outstanding borrows for this token.')
                      return
                    }
                    
                    // Format the borrow balance
                    const maxRepayAmountFormatted = ethers.formatUnits(currentBorrowBalance, tokenDecimals)
                    
                    // Round down more aggressively to prevent overflow
                    // The contract accrues interest before checking, which can increase the balance slightly
                    // Use fewer decimal places based on token decimals
                    // For 6 decimals (USDC): round to 2 decimal places
                    // For 18 decimals: round to 3 decimal places
                    const amountAsNumber = parseFloat(maxRepayAmountFormatted)
                    const decimalPlaces = tokenDecimals === 6 ? 2 : 3
                    
                    // Round down by multiplying, flooring, then dividing
                    const multiplier = Math.pow(10, decimalPlaces)
                    const roundedDown = Math.floor(amountAsNumber * multiplier) / multiplier
                    
                    // Ensure it's not negative or zero
                    if (roundedDown <= 0) {
                      showInfo(`Borrow balance is too small to repay (less than ${1 / multiplier}).`)
                      return
                    }
                    
                    // Format to the appropriate decimal places
                    const roundedString = roundedDown.toFixed(decimalPlaces)
                    
                    // Double-check: parse it back and ensure it's not more than the balance
                    // Add a small buffer (0.1%) to account for interest accrual
                    const buffer = currentBorrowBalance / 1000n // 0.1% buffer
                    const maxAllowed = currentBorrowBalance > buffer ? currentBorrowBalance - buffer : currentBorrowBalance
                    const parsedAmount = ethers.parseUnits(roundedString, tokenDecimals)
                    const finalAmount = parsedAmount > maxAllowed ? maxAllowed : parsedAmount
                    const finalFormatted = ethers.formatUnits(finalAmount, tokenDecimals)
                    
                    // Set the final rounded amount (round down again to ensure we don't exceed)
                    const finalAmountNumber = parseFloat(finalFormatted)
                    const finalRounded = Math.floor(finalAmountNumber * multiplier) / multiplier
                    setRepayAmount(finalRounded.toFixed(decimalPlaces))
                  } catch (error: any) {
                    console.error('Error getting max repay:', error)
                    showWarning(`Unable to calculate max repay: ${error.message || 'Unknown error'}. Please enter amount manually.`)
                  }
                }}
                className="px-3 py-2 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                title="Set to maximum repay amount (full borrow balance)"
              >
                Max
              </button>
            </div>
            <button
              onClick={handleRepay}
              disabled={isLoadingRepay || !repayAmount}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingRepay && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Repay</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Admin Section - Add Market */}
      {isOwner && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border-2 border-blue-500">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <AlertCircle className="h-6 w-6 text-slate-900 dark:text-white" />
            <span>Admin: Add Market</span>
          </h2>
          <p className="text-sm text-slate-900 dark:text-white/80 mb-4">
            As the contract owner, you can add new token markets to the lending pool.
            Reserve factor is in basis points (e.g., 1000 = 10%, 500 = 5%).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Token Address
              </label>
              <TokenSelector
                value={newMarketToken}
                onChange={setNewMarketToken}
                label="Select Token to Add"
                showCustomInput={true}
              />
              {newMarketToken && <TokenInfo address={newMarketToken} />}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Reserve Factor (basis points)
              </label>
              <input
                type="number"
                value={reserveFactor}
                onChange={(e) => setReserveFactor(e.target.value)}
                placeholder="1000 (10%)"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-900 dark:text-white/70 mt-1">
                Recommended: 1000 (10%) for stablecoins, 1500 (15%) for volatile tokens
              </p>
            </div>
            <button
              onClick={handleAddMarket}
              disabled={isLoadingAddMarket || !newMarketToken || !reserveFactor}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingAddMarket && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoadingAddMarket ? 'Adding Market...' : 'Add Market'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Admin Section - Configure Collateral */}
      {isOwner && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border-2 border-purple-500">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <Shield className="h-6 w-6 text-purple-500" />
            <span>Admin: Configure Collateral</span>
          </h2>
          <p className="text-sm text-slate-900 dark:text-white/80 mb-4">
            Configure tokens that can be used as collateral. LTV (Loan-to-Value) and liquidation threshold are in basis points.
            LTV must be less than liquidation threshold (e.g., LTV: 7500 = 75%, Threshold: 8000 = 80%).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Token Address
              </label>
              <TokenSelector
                value={newCollateralToken}
                onChange={setNewCollateralToken}
                label="Select Collateral Token"
                showCustomInput={true}
              />
              {newCollateralToken && <TokenInfo address={newCollateralToken} />}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                LTV (Loan-to-Value) - Basis Points
              </label>
              <input
                type="number"
                value={ltv}
                onChange={(e) => setLtv(e.target.value)}
                placeholder="7500 (75%)"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-900 dark:text-white/70 mt-1">
                Recommended: 7500 (75%) for stablecoins, 5000-6500 (50-65%) for volatile tokens
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Liquidation Threshold - Basis Points
              </label>
              <input
                type="number"
                value={liquidationThreshold}
                onChange={(e) => setLiquidationThreshold(e.target.value)}
                placeholder="8000 (80%)"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-900 dark:text-white/70 mt-1">
                Must be greater than LTV. Recommended: 8000 (80%) for stablecoins, 7000-7500 (70-75%) for volatile tokens
              </p>
            </div>
            <button
              onClick={handleConfigureCollateral}
              disabled={isLoadingConfigureCollateral || !newCollateralToken || !ltv || !liquidationThreshold}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingConfigureCollateral && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoadingConfigureCollateral ? 'Configuring Collateral...' : 'Configure Collateral'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

