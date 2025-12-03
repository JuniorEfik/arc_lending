'use client'

import { useState } from 'react'
import { Wallet, CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

interface ConnectWalletProps {
  isConnected: boolean
  account: string | null
  onConnect: () => void
}

export function ConnectWallet({ isConnected, account, onConnect }: ConnectWalletProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const { showError, showWarning } = useToast()

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      showError('Please install MetaMask or another Web3 wallet')
      return
    }

    setIsConnecting(true)
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const { switchToArcNetwork } = await import('@/lib/web3')
      await switchToArcNetwork()
      onConnect()
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      if (error.message?.includes('user rejected') || error.code === 4001) {
        showWarning('Connection was rejected. Please approve the connection in your wallet.')
      } else if (error.message?.includes('Arc Testnet')) {
        showError(error.message)
      } else {
        showError('Failed to connect wallet. Please make sure you approve the connection and network switch.')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (isConnected && account) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
          {account.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
          {formatAddress(account)}
        </span>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      </div>
    )
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="workbird-button px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
    >
      {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
    </button>
  )
}
