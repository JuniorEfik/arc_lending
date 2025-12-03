'use client'

import { useState, useEffect } from 'react'
import { Building2, FileText, CheckCircle, ChevronDown, ChevronUp, Database, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { getDeliveryVsPayment, getSettlementEngine, getERC20WithSigner, getERC20 } from '@/lib/web3'
import { TokenSelector } from './TokenSelector'
import { ethers } from 'ethers'
import { useToast } from '@/contexts/ToastContext'

interface CapitalMarketsProps {
  account: string
}

interface Settlement {
  id: string
  buyer: string
  seller: string
  assetToken: string
  paymentToken: string
  assetAmount: string
  paymentAmount: string
  deadline: number
  executed: boolean
  cancelled: boolean
}

export function CapitalMarkets({ account }: CapitalMarketsProps) {
  const { showSuccess, showError, showWarning, showInfo } = useToast()
  const [assetToken, setAssetToken] = useState('')
  const [paymentToken, setPaymentToken] = useState('')
  const [assetAmount, setAssetAmount] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [sellerAddress, setSellerAddress] = useState('')
  const [deadline, setDeadline] = useState('')
  const [settlementId, setSettlementId] = useState('')
  const [cancelSettlementId, setCancelSettlementId] = useState('')
  const [createdSettlementId, setCreatedSettlementId] = useState('')
  const [isLoadingCreate, setIsLoadingCreate] = useState(false)
  const [isLoadingExecute, setIsLoadingExecute] = useState(false)
  const [isLoadingCancel, setIsLoadingCancel] = useState(false)
  const [unsettledSettlements, setUnsettledSettlements] = useState<Settlement[]>([])
  const [expandedSettlements, setExpandedSettlements] = useState<Set<string>>(new Set())
  const [isLoadingSettlements, setIsLoadingSettlements] = useState(false)

  const handleCreateSettlement = async () => {
    if (!assetToken || !paymentToken || !assetAmount || !paymentAmount || !sellerAddress) {
      showWarning('Please fill in all fields')
      return
    }
    
    if (!ethers.isAddress(assetToken) || !ethers.isAddress(paymentToken) || !ethers.isAddress(sellerAddress)) {
      showError('Invalid token or seller address')
      return
    }
    
    // Check: Seller cannot be the same as the connected wallet (buyer)
    if (sellerAddress.toLowerCase() === account.toLowerCase()) {
      showError('Error: Seller address cannot be the same as your connected wallet. You cannot sell to yourself.')
      return
    }
    
    setIsLoadingCreate(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      // Get token decimals for proper amount parsing
      let assetDecimals = 18
      let paymentDecimals = 18
      try {
        const assetTokenContract = getERC20(assetToken)
        assetDecimals = await assetTokenContract.decimals()
      } catch (error) {
        console.warn('Could not get asset token decimals, using 18:', error)
      }
      try {
        const paymentTokenContract = getERC20(paymentToken)
        paymentDecimals = await paymentTokenContract.decimals()
      } catch (error) {
        console.warn('Could not get payment token decimals, using 18:', error)
      }
      
      // Parse amounts with correct decimals
      const assetAmountWei = ethers.parseUnits(assetAmount, assetDecimals)
      const paymentAmountWei = ethers.parseUnits(paymentAmount, paymentDecimals)
      
      const deadlineTimestamp = deadline 
        ? Math.floor(new Date(deadline).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 86400 // Default: 24 hours
      
      // Get DeliveryVsPayment contract address
      const dvp = await getDeliveryVsPayment()
      const dvpAddress = await dvp.getAddress()
      
      // Check and approve payment token (buyer needs to approve payment)
      const paymentTokenWithSigner = await getERC20WithSigner(paymentToken)
      let allowance = 0n
      try {
        allowance = await paymentTokenWithSigner.allowance(account, dvpAddress)
      } catch (error: any) {
        console.warn('allowance() failed, will attempt approval anyway:', error.message)
        allowance = 0n
      }
      
      if (allowance < paymentAmountWei) {
        console.log('Approving payment token...')
        try {
          const approveTx = await paymentTokenWithSigner.approve(dvpAddress, paymentAmountWei)
          console.log('Approval transaction sent:', approveTx.hash)
          const approveReceipt = await approveTx.wait()
          console.log('Approval confirmed in block:', approveReceipt.blockNumber)
        } catch (approveError: any) {
          console.error('Approval failed:', approveError)
          if (approveError.message?.includes('user rejected') || approveError.code === 4001) {
            throw new Error('Transaction was rejected. Please approve the transaction in your wallet.')
          }
          throw new Error(`Payment token approval failed: ${approveError.message || approveError.reason || 'Unknown error'}. Make sure you have sufficient balance and the token supports approve().`)
        }
      }
      
      // Create settlement
      const tx = await dvp.createSettlement(
        sellerAddress,
        assetToken,
        paymentToken,
        assetAmountWei,
        paymentAmountWei,
        deadlineTimestamp
      )
      const receipt = await tx.wait()
      
      // Get settlement ID from events
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = dvp.interface.parseLog(log)
          return parsed?.name === 'SettlementCreated'
        } catch {
          return false
        }
      })
      
      if (event) {
        const parsed = dvp.interface.parseLog(event)
        const settlementId = parsed?.args[0]
        setCreatedSettlementId(settlementId)
        
        // Save settlement ID to localStorage for this user
        saveSettlementIdToStorage(account, settlementId)
        
        // Reload settlements
        loadUnsettledSettlements()
        
        showSuccess(`Settlement created! ID: ${settlementId}`)
      } else {
        showSuccess('Settlement created! Check transaction receipt for settlement ID.')
      }
      
      setAssetToken('')
      setPaymentToken('')
      setAssetAmount('')
      setPaymentAmount('')
      setSellerAddress('')
      setDeadline('')
    } catch (error: any) {
      console.error('Error creating settlement:', error)
      showError(error.message || 'Failed to create settlement')
    } finally {
      setIsLoadingCreate(false)
    }
  }

  const handleExecuteSettlement = async (id?: string) => {
    const settlementIdToUse = id || settlementId
    if (!settlementIdToUse) {
      showWarning('Please enter a settlement ID')
      return
    }
    
    // Settlement ID is a bytes32 (hex string), not an address
    if (!ethers.isHexString(settlementIdToUse)) {
      showError('Invalid settlement ID format. Settlement ID should be a hex string (0x...)')
      return
    }
    
    setIsLoadingCreate(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const dvp = await getDeliveryVsPayment()
      const dvpAddress = await dvp.getAddress()
      
      // Get settlement details to check asset token and amount
      let settlement: any
      try {
        settlement = await dvp.getSettlement(settlementIdToUse)
      } catch (error: any) {
        throw new Error(`Failed to get settlement details: ${error.message || 'Settlement not found'}`)
      }
      
      // Verify seller is the one executing
      if (settlement.seller.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only the seller can execute this settlement')
      }
      
      // Additional check: Seller cannot be the same as buyer (shouldn't happen but double-check)
      if (settlement.seller.toLowerCase() === settlement.buyer.toLowerCase()) {
        throw new Error('Invalid settlement: Seller and buyer cannot be the same address')
      }
      
      // Check if already executed or cancelled
      if (settlement.executed) {
        throw new Error('Settlement has already been executed')
      }
      if (settlement.cancelled) {
        throw new Error('Settlement has been cancelled')
      }
      
      // Check deadline
      const currentTimestamp = Math.floor(Date.now() / 1000)
      if (currentTimestamp > Number(settlement.deadline)) {
        throw new Error('Settlement has expired')
      }
      
      // Seller needs to approve asset token for transfer to buyer
      const assetTokenAddress = settlement.assetToken
      const assetAmount = settlement.assetAmount
      
      const assetTokenWithSigner = await getERC20WithSigner(assetTokenAddress)
      let allowance = 0n
      try {
        allowance = await assetTokenWithSigner.allowance(account, dvpAddress)
      } catch (error: any) {
        console.warn('allowance() failed, will attempt approval anyway:', error.message)
        allowance = 0n
      }
      
      if (allowance < assetAmount) {
        console.log('Approving asset token...')
        try {
          const approveTx = await assetTokenWithSigner.approve(dvpAddress, assetAmount)
          console.log('Approval transaction sent:', approveTx.hash)
          const approveReceipt = await approveTx.wait()
          console.log('Approval confirmed in block:', approveReceipt.blockNumber)
        } catch (approveError: any) {
          console.error('Approval failed:', approveError)
          if (approveError.message?.includes('user rejected') || approveError.code === 4001) {
            throw new Error('Transaction was rejected. Please approve the transaction in your wallet.')
          }
          throw new Error(`Asset token approval failed: ${approveError.message || approveError.reason || 'Unknown error'}. Make sure you have sufficient balance and the token supports approve().`)
        }
      }
      
      // Execute settlement
      const tx = await dvp.executeSettlement(settlementIdToUse)
      console.log('Execute settlement transaction sent:', tx.hash)
      const receipt = await tx.wait()
      console.log('Settlement executed in block:', receipt.blockNumber)
      showSuccess('Settlement executed successfully!')
      if (!id) {
        setSettlementId('')
      }
      
      // Reload settlements to update status
      loadUnsettledSettlements()
    } catch (error: any) {
      console.error('Error executing settlement:', error)
      let errorMessage = error.reason || error.message || 'Failed to execute settlement'
      if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      } else if (error.message?.includes('Only seller')) {
        errorMessage = 'Only the seller can execute this settlement'
      } else if (error.message?.includes('expired')) {
        errorMessage = 'Settlement has expired'
      } else if (error.message?.includes('already been executed')) {
        errorMessage = 'Settlement has already been executed'
      } else if (error.message?.includes('cancelled')) {
        errorMessage = 'Settlement has been cancelled'
      }
      showError(errorMessage)
    } finally {
      setIsLoadingExecute(false)
    }
  }

  const handleCancelSettlement = async (id?: string) => {
    const cancelSettlementIdToUse = id || cancelSettlementId
    if (!cancelSettlementIdToUse) {
      showWarning('Please enter a settlement ID')
      return
    }
    
    // Settlement ID is a bytes32 (hex string), not an address
    if (!ethers.isHexString(cancelSettlementIdToUse)) {
      showError('Invalid settlement ID format. Settlement ID should be a hex string (0x...)')
      return
    }
    
    setIsLoadingCreate(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const dvp = await getDeliveryVsPayment()
      
      // Get settlement details
      let settlement: any
      try {
        settlement = await dvp.getSettlement(cancelSettlementIdToUse)
      } catch (error: any) {
        throw new Error(`Failed to get settlement details: ${error.message || 'Settlement not found'}`)
      }
      
      // Check if already executed or cancelled
      if (settlement.executed) {
        throw new Error('Cannot cancel: Settlement has already been executed')
      }
      if (settlement.cancelled) {
        throw new Error('Settlement has already been cancelled')
      }
      
      // Check if seller is trying to cancel (contract only allows buyer/owner)
      const currentTimestamp = Math.floor(Date.now() / 1000)
      const isExpired = currentTimestamp > Number(settlement.deadline)
      const isSeller = settlement.seller.toLowerCase() === account.toLowerCase()
      
      // Seller cannot cancel directly (contract restriction)
      // But we inform them if settlement has expired
      if (isSeller) {
        if (isExpired) {
          throw new Error('Seller cannot cancel settlements directly. Only the buyer or contract owner can cancel. Since this settlement has expired and was not executed, please contact the buyer to cancel and get their refund, or contact the contract owner.')
        } else {
          throw new Error('Seller cannot cancel settlements. Only the buyer or contract owner can cancel. If you need to cancel, please contact the buyer or wait until the settlement expires.')
        }
      }
      
      // Check authorization: Only buyer or owner can cancel
      const isBuyer = settlement.buyer.toLowerCase() === account.toLowerCase()
      
      // Try to get owner (might fail if not available)
      let isOwner = false
      try {
        const owner = await dvp.owner()
        isOwner = owner.toLowerCase() === account.toLowerCase()
      } catch {
        // Owner check failed, continue with buyer check only
      }
      
      if (!isBuyer && !isOwner) {
        throw new Error('Only the buyer or contract owner can cancel this settlement')
      }
      
      // Cancel settlement (only buyer or owner can do this)
      const tx = await dvp.cancelSettlement(cancelSettlementIdToUse)
      console.log('Cancel settlement transaction sent:', tx.hash)
      const receipt = await tx.wait()
      console.log('Settlement cancelled in block:', receipt.blockNumber)
      showSuccess('Settlement cancelled successfully! Payment has been refunded to the buyer.')
      if (!id) {
        setCancelSettlementId('')
      }
      
      // Reload settlements to update status
      loadUnsettledSettlements()
    } catch (error: any) {
      console.error('Error cancelling settlement:', error)
      let errorMessage = error.reason || error.message || 'Failed to cancel settlement'
      if (error.message?.includes('user rejected') || error.code === 4001) {
        errorMessage = 'Transaction was rejected'
      } else if (error.message?.includes('Only the buyer')) {
        errorMessage = 'Only the buyer or contract owner can cancel this settlement'
      } else if (error.message?.includes('already been executed')) {
        errorMessage = 'Cannot cancel: Settlement has already been executed'
      } else if (error.message?.includes('already been cancelled')) {
        errorMessage = 'Settlement has already been cancelled'
      } else if (error.message?.includes('Seller cannot cancel')) {
        errorMessage = error.message
      }
      showError(errorMessage)
    } finally {
      setIsLoadingCancel(false)
    }
  }

  // Save settlement ID to localStorage for a specific user
  const saveSettlementIdToStorage = (userAddress: string, settlementId: string) => {
    if (typeof window === 'undefined') return
    
    const key = `settlements_${userAddress.toLowerCase()}`
    const existing = localStorage.getItem(key)
    const settlementIds = existing ? JSON.parse(existing) : []
    
    // Add if not already present
    if (!settlementIds.includes(settlementId)) {
      settlementIds.push(settlementId)
      localStorage.setItem(key, JSON.stringify(settlementIds))
    }
  }

  // Get settlement IDs from localStorage for a specific user
  const getSettlementIdsFromStorage = (userAddress: string): string[] => {
    if (typeof window === 'undefined') return []
    
    const key = `settlements_${userAddress.toLowerCase()}`
    const existing = localStorage.getItem(key)
    return existing ? JSON.parse(existing) : []
  }

  // Load and filter unsettled settlements for the current user
  const loadUnsettledSettlements = async () => {
    if (!account) {
      setUnsettledSettlements([])
      return
    }

    setIsLoadingSettlements(true)
    try {
      const dvp = await getDeliveryVsPayment()
      const settlementIds = getSettlementIdsFromStorage(account)
      
      const settlements: Settlement[] = []
      const currentTimestamp = Math.floor(Date.now() / 1000)
      
      // Fetch details for each settlement ID
      for (const id of settlementIds) {
        try {
          const settlement = await dvp.getSettlement(id)
          
          // Only include unsettled settlements (not executed, not cancelled)
          // And only if user is buyer or seller
          const isBuyer = settlement.buyer.toLowerCase() === account.toLowerCase()
          const isSeller = settlement.seller.toLowerCase() === account.toLowerCase()
          
          if (!settlement.executed && !settlement.cancelled && (isBuyer || isSeller)) {
            // Get token decimals for formatting
            let assetDecimals = 18
            let paymentDecimals = 18
            try {
              assetDecimals = await getERC20(settlement.assetToken).decimals()
            } catch {}
            try {
              paymentDecimals = await getERC20(settlement.paymentToken).decimals()
            } catch {}
            
            settlements.push({
              id,
              buyer: settlement.buyer,
              seller: settlement.seller,
              assetToken: settlement.assetToken,
              paymentToken: settlement.paymentToken,
              assetAmount: ethers.formatUnits(settlement.assetAmount, assetDecimals),
              paymentAmount: ethers.formatUnits(settlement.paymentAmount, paymentDecimals),
              deadline: Number(settlement.deadline),
              executed: settlement.executed,
              cancelled: settlement.cancelled,
            })
          }
        } catch (error) {
          // Settlement might not exist or be invalid, skip it
          console.warn(`Failed to load settlement ${id}:`, error)
        }
      }
      
      // Sort by deadline (soonest first)
      settlements.sort((a, b) => a.deadline - b.deadline)
      
      setUnsettledSettlements(settlements)
    } catch (error) {
      console.error('Error loading settlements:', error)
      setUnsettledSettlements([])
    } finally {
      setIsLoadingSettlements(false)
    }
  }

  // Toggle expansion of a settlement row
  const toggleExpansion = (settlementId: string) => {
    const newExpanded = new Set(expandedSettlements)
    if (newExpanded.has(settlementId)) {
      newExpanded.delete(settlementId)
    } else {
      newExpanded.add(settlementId)
    }
    setExpandedSettlements(newExpanded)
  }

  // Load settlements when account changes
  useEffect(() => {
    if (account) {
      loadUnsettledSettlements()
    } else {
      setUnsettledSettlements([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Format deadline
  const formatDeadline = (deadline: number) => {
    const date = new Date(deadline * 1000)
    const now = Date.now()
    const diff = deadline * 1000 - now
    
    if (diff < 0) {
      return `Expired ${Math.abs(Math.floor(diff / (1000 * 60 * 60)))}h ago`
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) {
      return `${days}d ${hours % 24}h remaining`
    }
    return `${hours}h remaining`
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6"
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Building2 className="h-6 w-6 icon-gradient icon-glow" />
          </motion.div>
          <span>Capital Markets</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create DvP Settlement */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <FileText className="h-5 w-5 icon-gradient" />
              </motion.div>
              <span>Create DvP Settlement</span>
            </h3>

            <div>
              <TokenSelector
                value={assetToken}
                onChange={setAssetToken}
                label="Asset Token"
                showCustomInput={true}
              />
            </div>

            <div>
              <TokenSelector
                value={paymentToken}
                onChange={setPaymentToken}
                label="Payment Token"
                showCustomInput={true}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Asset Amount
              </label>
              <input
                type="number"
                value={assetAmount}
                onChange={(e) => setAssetAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Payment Amount
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Seller Address
              </label>
              <input
                type="text"
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Deadline (optional, defaults to 24h)
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {createdSettlementId && (
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                <div className="text-sm text-slate-900 dark:text-white/80">Created Settlement ID:</div>
                <div className="text-xs font-mono text-primary-600 dark:text-primary-400 break-all">
                  {createdSettlementId}
                </div>
              </div>
            )}

            <button
              onClick={handleCreateSettlement}
              disabled={isLoadingCreate || !assetToken || !paymentToken || !assetAmount || !paymentAmount || !sellerAddress}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingCreate && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoadingCreate ? 'Creating...' : 'Create Settlement'}</span>
            </button>
          </motion.div>

          {/* Execute Settlement */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <CheckCircle className="h-5 w-5 icon-gradient" />
              </motion.div>
              <span>Execute Settlement</span>
            </h3>
            <p className="text-xs text-slate-900 dark:text-white/70">
              Only the seller can execute a settlement. The buyer cannot execute settlements.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Settlement ID
              </label>
              <input
                type="text"
                value={settlementId}
                onChange={(e) => setSettlementId(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              onClick={() => handleExecuteSettlement()}
              disabled={isLoadingExecute || !settlementId}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingExecute && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Execute Settlement</span>
            </button>
          </motion.div>
        </div>

        {/* Cancel Settlement */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Cancel Settlement</span>
          </h3>
          <p className="text-xs text-slate-900 dark:text-white/70 mb-4">
            Only the buyer or contract owner can cancel a settlement. Sellers cannot cancel directly, but if a settlement has expired and not been executed, the buyer should cancel to get a refund.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
              Settlement ID
            </label>
            <input
              type="text"
              value={cancelSettlementId}
              onChange={(e) => setCancelSettlementId(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <button
            onClick={() => handleCancelSettlement()}
            disabled={isLoadingCancel || !cancelSettlementId}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 mt-4 flex items-center justify-center space-x-2"
          >
            {isLoadingCancel && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Cancel Settlement</span>
          </button>

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mt-4">
            <div className="text-sm text-slate-900 dark:text-white/80 mb-2">Contract Addresses</div>
            <div className="text-xs font-mono text-slate-900 dark:text-white/70 space-y-1">
              <div>DvP: {CONTRACT_ADDRESSES.deliveryVsPayment.slice(0, 10)}...</div>
              <div>Settlement: {CONTRACT_ADDRESSES.settlementEngine.slice(0, 10)}...</div>
            </div>
          </div>
        </div>

        {/* Unsettled Settlements Database */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mt-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Database className="h-5 w-5 icon-gradient icon-glow" />
              </motion.div>
              <span>My Unsettled Settlements</span>
            </h3>
            <button
              onClick={loadUnsettledSettlements}
              disabled={isLoadingSettlements || !account}
              className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoadingSettlements ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {!account ? (
            <p className="text-sm text-slate-900 dark:text-white/70 text-center py-4">
              Please connect your wallet to view your settlements
            </p>
          ) : unsettledSettlements.length === 0 ? (
            <p className="text-sm text-slate-900 dark:text-white/70 text-center py-4">
              No unsettled settlements found. Create a settlement to see it here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-slate-600">
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-white/90">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-white/90">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-white/90">Asset</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-white/90">Payment</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-white/90">Deadline</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-white/90">Actions</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-white/90"></th>
                  </tr>
                </thead>
                <tbody>
                  {unsettledSettlements.map((settlement) => {
                    const isBuyer = settlement.buyer.toLowerCase() === account.toLowerCase()
                    const isSeller = settlement.seller.toLowerCase() === account.toLowerCase()
                    const isExpanded = expandedSettlements.has(settlement.id)
                    const isExpired = Math.floor(Date.now() / 1000) > settlement.deadline
                    
                    return (
                      <tr key={settlement.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-200 dark:bg-slate-700">
                        <td className="py-3 px-4">
                          <div className="font-mono text-xs text-slate-900 dark:text-white/80">
                            {settlement.id.slice(0, 10)}...
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isBuyer 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          }`}>
                            {isBuyer ? 'Buyer' : 'Seller'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{settlement.assetAmount}</div>
                          <div className="text-xs text-slate-900 dark:text-white/70 font-mono">
                            {formatAddress(settlement.assetToken)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{settlement.paymentAmount}</div>
                          <div className="text-xs text-slate-900 dark:text-white/70 font-mono">
                            {formatAddress(settlement.paymentToken)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`text-xs ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white/80'}`}>
                            {formatDeadline(settlement.deadline)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            {isSeller && !isExpired && (
                              <button
                                onClick={() => handleExecuteSettlement(settlement.id)}
                                disabled={isLoadingExecute}
                                className="px-2 py-1 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                              >
                                {isLoadingExecute && <Loader2 className="h-3 w-3 animate-spin" />}
                                <span>Execute</span>
                              </button>
                            )}
                            {isBuyer && (
                              <button
                                onClick={() => handleCancelSettlement(settlement.id)}
                                disabled={isLoadingCancel}
                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                              >
                                {isLoadingCancel && <Loader2 className="h-3 w-3 animate-spin" />}
                                <span>Cancel</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleExpansion(settlement.id)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-900 dark:text-white/80" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-900 dark:text-white/80" />
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {/* Expanded Details */}
              {unsettledSettlements.map((settlement) => {
                if (!expandedSettlements.has(settlement.id)) return null
                
                const isBuyer = settlement.buyer.toLowerCase() === account.toLowerCase()
                
                return (
                  <div key={`details-${settlement.id}`} className="bg-slate-50 dark:bg-slate-700/50 p-4 border-t border-slate-300 dark:border-slate-600">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Settlement ID</div>
                        <div className="font-mono text-xs break-all">{settlement.id}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Status</div>
                        <div className="text-xs">
                          {settlement.executed ? (
                            <span className="text-green-600 dark:text-green-400">Executed</span>
                          ) : settlement.cancelled ? (
                            <span className="text-red-600 dark:text-red-400">Cancelled</span>
                          ) : (
                            <span className="text-yellow-600 dark:text-yellow-400">Pending</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Buyer</div>
                        <div className="font-mono text-xs">{formatAddress(settlement.buyer)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Seller</div>
                        <div className="font-mono text-xs">{formatAddress(settlement.seller)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Asset Token</div>
                        <div className="font-mono text-xs break-all">{settlement.assetToken}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Payment Token</div>
                        <div className="font-mono text-xs break-all">{settlement.paymentToken}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Your Role</div>
                        <div className="text-xs font-medium">
                          {isBuyer ? 'Buyer (You pay, receive asset)' : 'Seller (You deliver asset, receive payment)'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-900 dark:text-white/70 mb-1">Deadline</div>
                        <div className="text-xs">
                          {new Date(settlement.deadline * 1000).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

