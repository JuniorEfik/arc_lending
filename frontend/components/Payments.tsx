'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { CreditCard, Send, FileText, Loader2, Database, X, ChevronDown, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { getPaymentRouter, getERC20WithSigner, getERC20 } from '@/lib/web3'
import { TokenSelector } from './TokenSelector'
import { getTokenByAddress } from '@/config/tokens'
import { ethers } from 'ethers'

interface PaymentsProps {
  account: string
}

interface Payment {
  paymentHash: string
  sender: string
  recipient: string
  token: string
  amount: string
  fee: string
  timestamp: number
  executed: boolean
  cancelled: boolean
  paymentId: string
}

export function Payments({ account }: PaymentsProps) {
  const { showSuccess, showError, showWarning } = useToast()
  const [recipient, setRecipient] = useState('')
  const [tokenAddress, setTokenAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [paymentHash, setPaymentHash] = useState('')
  const [isLoadingCreate, setIsLoadingCreate] = useState(false)
  const [isLoadingExecute, setIsLoadingExecute] = useState(false)
  const [unsettledPayments, setUnsettledPayments] = useState<Payment[]>([])
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [isLoadingCancel, setIsLoadingCancel] = useState(false)

  const handleCreatePayment = async () => {
    if (!recipient || !tokenAddress || !amount || !paymentId) {
      showWarning('Please fill in all fields')
      return
    }
    
    if (!ethers.isAddress(recipient) || !ethers.isAddress(tokenAddress)) {
      showError('Invalid recipient or token address')
      return
    }
    
    setIsLoadingCreate(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      // Get token decimals for proper amount parsing
      let tokenDecimals = 18
      try {
        const tokenContract = getERC20(tokenAddress)
        tokenDecimals = await tokenContract.decimals()
      } catch (error) {
        console.warn('Could not get token decimals, using 18:', error)
      }
      
      // Parse amount with correct decimals
      const amountWei = ethers.parseUnits(amount, tokenDecimals)
      
      // Get PaymentRouter contract address
      const paymentRouter = await getPaymentRouter()
      const paymentRouterAddress = await paymentRouter.getAddress()
      
      // Check and approve token
      const token = await getERC20WithSigner(tokenAddress)
      let allowance = 0n
      try {
        allowance = await token.allowance(account, paymentRouterAddress)
      } catch (error: any) {
        console.warn('allowance() failed, will attempt approval anyway:', error.message)
        allowance = 0n
      }
      
      if (allowance < amountWei) {
        console.log('Approving payment token...')
        try {
          const approveTx = await token.approve(paymentRouterAddress, amountWei)
          console.log('Approval transaction sent:', approveTx.hash)
          const approveReceipt = await approveTx.wait()
          console.log('Approval confirmed in block:', approveReceipt.blockNumber)
        } catch (approveError: any) {
          console.error('Approval failed:', approveError)
          if (approveError.message?.includes('user rejected') || approveError.code === 4001) {
            throw new Error('Transaction was rejected. Please approve the transaction in your wallet.')
          }
          throw new Error(`Token approval failed: ${approveError.message || approveError.reason || 'Unknown error'}. Make sure you have sufficient balance and the token supports approve().`)
        }
      }
      
      // Create payment
      const tx = await paymentRouter.createPayment(recipient, tokenAddress, amountWei, paymentId)
      const receipt = await tx.wait()
      
      // Get payment hash from events
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = paymentRouter.interface.parseLog(log)
          return parsed?.name === 'PaymentCreated'
        } catch {
          return false
        }
      })
      
      if (event) {
        const parsed = paymentRouter.interface.parseLog(event)
        const paymentHash = parsed?.args[0]
        setPaymentHash(paymentHash)
        
        // Get payment details from contract
        const paymentData = await paymentRouter.getPayment(paymentHash)
        
        // Save to localStorage
        const payment: Payment = {
          paymentHash: paymentHash,
          sender: paymentData.sender,
          recipient: paymentData.recipient,
          token: paymentData.token,
          amount: paymentData.amount.toString(),
          fee: paymentData.fee.toString(),
          timestamp: Number(paymentData.timestamp),
          executed: paymentData.executed,
          cancelled: paymentData.cancelled || false,
          paymentId: paymentData.paymentId,
        }
        
        const stored = localStorage.getItem(`payments_${account}`)
        const payments: Payment[] = stored ? JSON.parse(stored) : []
        payments.push(payment)
        localStorage.setItem(`payments_${account}`, JSON.stringify(payments))
        
        showSuccess(`Payment created! Hash: ${paymentHash}`)
        loadUnsettledPayments()
      } else {
        showSuccess('Payment created successfully!')
      }
      
      setRecipient('')
      setTokenAddress('')
      setAmount('')
      setPaymentId('')
    } catch (error: any) {
      console.error('Create payment error:', error)
      showError(error.message || 'Failed to create payment')
    } finally {
      setIsLoadingCreate(false)
    }
  }

  const handleExecutePayment = async () => {
    if (!paymentHash) return
    setIsLoadingExecute(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      const paymentRouter = await getPaymentRouter()
      const tx = await paymentRouter.executePayment(paymentHash)
      await tx.wait()
      showSuccess('Payment executed successfully!')
      setPaymentHash('')
      loadUnsettledPayments()
    } catch (error: any) {
      showError(error.message || 'Failed to execute payment')
    } finally {
      setIsLoadingExecute(false)
    }
  }

  const loadUnsettledPayments = async () => {
    if (!account) return
    setIsLoadingPayments(true)
    try {
      const stored = localStorage.getItem(`payments_${account}`)
      if (!stored) {
        setUnsettledPayments([])
        return
      }

      const payments: Payment[] = JSON.parse(stored)
      const paymentRouter = await getPaymentRouter()
      
      // Check each payment's status from contract
      const updatedPayments = await Promise.all(
        payments.map(async (payment) => {
          try {
            const paymentData = await paymentRouter.getPayment(payment.paymentHash)
            return {
              ...payment,
              executed: paymentData.executed,
              cancelled: paymentData.cancelled || false,
            }
          } catch {
            return payment
          }
        })
      )

      // Filter to only show payments where sender is current user and not executed or cancelled
      const unsettled = updatedPayments.filter(
        (p) => p.sender.toLowerCase() === account.toLowerCase() && !p.executed && !p.cancelled
      )

      // Update localStorage with updated status
      localStorage.setItem(`payments_${account}`, JSON.stringify(updatedPayments))
      setUnsettledPayments(unsettled)
    } catch (error) {
      console.error('Error loading unsettled payments:', error)
      showError('Failed to load unsettled payments')
    } finally {
      setIsLoadingPayments(false)
    }
  }

  const handleCancelPayment = async (paymentHash: string) => {
    setIsLoadingCancel(true)
    try {
      // Ensure we're on Arc Testnet before proceeding
      const { ensureArcNetwork } = await import('@/lib/web3')
      await ensureArcNetwork()
      
      const paymentRouter = await getPaymentRouter()
      const tx = await paymentRouter.cancelPayment(paymentHash)
      await tx.wait()
      showSuccess('Payment cancelled successfully!')
      loadUnsettledPayments()
    } catch (error: any) {
      console.error('Cancel payment error:', error)
      const errorMessage = error.reason || error.message || 'Failed to cancel payment'
      showError(errorMessage)
    } finally {
      setIsLoadingCancel(false)
    }
  }

  useEffect(() => {
    if (account) {
      loadUnsettledPayments()
    }
  }, [account])

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
            <CreditCard className="h-6 w-6 icon-gradient icon-glow" />
          </motion.div>
          <span>Payment System</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Payment */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Send className="h-5 w-5 icon-gradient" />
              </motion.div>
              <span>Create Payment</span>
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <TokenSelector
                value={tokenAddress}
                onChange={setTokenAddress}
                label="Payment Token"
                showCustomInput={true}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Payment ID
              </label>
              <input
                type="text"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="PAY-12345"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              onClick={handleCreatePayment}
              disabled={isLoadingCreate || !recipient || !tokenAddress || !amount || !paymentId}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingCreate && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Create Payment</span>
            </button>
          </motion.div>

          {/* Execute Payment */}
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
                <FileText className="h-5 w-5 icon-gradient" />
              </motion.div>
              <span>Execute Payment</span>
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
                Payment Hash
              </label>
              <input
                type="text"
                value={paymentHash}
                onChange={(e) => setPaymentHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              onClick={handleExecutePayment}
              disabled={isLoadingExecute || !paymentHash}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoadingExecute && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Execute Payment</span>
            </button>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mt-4">
              <div className="text-sm text-slate-900 dark:text-white/80 mb-2">Payment Router</div>
              <div className="text-xs font-mono text-slate-900 dark:text-white/70">
                Address: 0x599950c8BE38673d49e6141fcCc7d8adcD7C03E7
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Unsettled Payments Database */}
      {account && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Database className="h-5 w-5 icon-gradient icon-glow" />
              </motion.div>
              <span>My Unsettled Payments</span>
            </h3>
            <button
              onClick={loadUnsettledPayments}
              disabled={isLoadingPayments || !account}
              className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isLoadingPayments && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Refresh</span>
            </button>
          </div>

          {unsettledPayments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              {isLoadingPayments ? 'Loading payments...' : 'No unsettled payments'}
            </div>
          ) : (
            <div className="space-y-3">
              {unsettledPayments.map((payment) => {
                const isExpanded = expandedPayments.has(payment.paymentHash)
                const tokenConfig = getTokenByAddress(payment.token)
                let tokenDecimals = 18
                try {
                  if (tokenConfig) {
                    tokenDecimals = tokenConfig.decimals
                  }
                } catch {}
                
                const amountFormatted = ethers.formatUnits(payment.amount, tokenDecimals)
                const feeFormatted = ethers.formatUnits(payment.fee, tokenDecimals)
                const netAmountFormatted = ethers.formatUnits(BigInt(payment.amount) - BigInt(payment.fee), tokenDecimals)

                return (
                  <div
                    key={payment.paymentHash}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            Payment ID: {payment.paymentId}
                          </span>
                          <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                            Pending
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Amount: {amountFormatted} {tokenConfig?.symbol || 'TOKEN'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-500 mt-1 font-mono">
                          {payment.paymentHash.slice(0, 10)}...{payment.paymentHash.slice(-8)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedPayments)
                            if (isExpanded) {
                              newExpanded.delete(payment.paymentHash)
                            } else {
                              newExpanded.add(payment.paymentHash)
                            }
                            setExpandedPayments(newExpanded)
                          }}
                          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleCancelPayment(payment.paymentHash)}
                          disabled={isLoadingCancel || payment.executed || payment.cancelled}
                          className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {isLoadingCancel && <Loader2 className="h-3 w-3 animate-spin" />}
                          <X className="h-3 w-3" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Recipient</div>
                            <div className="font-mono text-xs break-all">{payment.recipient}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Token</div>
                            <div className="font-mono text-xs break-all">{payment.token}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Gross Amount</div>
                            <div className="text-sm font-medium">{amountFormatted} {tokenConfig?.symbol || 'TOKEN'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fee</div>
                            <div className="text-sm font-medium">{feeFormatted} {tokenConfig?.symbol || 'TOKEN'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Net Amount</div>
                            <div className="text-sm font-medium">{netAmountFormatted} {tokenConfig?.symbol || 'TOKEN'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Created</div>
                            <div className="text-xs">
                              {new Date(payment.timestamp * 1000).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <button
                            onClick={() => {
                              setPaymentHash(payment.paymentHash)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Use this payment hash to execute
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

