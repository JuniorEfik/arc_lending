'use client'

import { useState, useEffect } from 'react'
import { Menu, X, DollarSign, ArrowLeftRight, Building2, CreditCard, Settings, TrendingUp, Wallet, LogOut, Moon, Sun, Droplet, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { ConnectWallet } from '@/components/ConnectWallet'
import { LendingDashboard } from '@/components/LendingDashboard'
import { FXTrading } from '@/components/FXTrading'
import { CapitalMarkets } from '@/components/CapitalMarkets'
import { Payments } from '@/components/Payments'
import { getProvider } from '@/lib/web3'
import { useToast } from '@/contexts/ToastContext'

export default function Home() {
  const { showWarning } = useToast()
  const [activeTab, setActiveTab] = useState('fx')
  const [isConnected, setIsConnected] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)


  useEffect(() => {
    checkConnection()
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', () => window.location.reload())
    }
    // Check for dark mode preference
    const isDark = localStorage.getItem('darkMode') === 'true'
    setDarkMode(isDark)
    if (isDark) {
      document.documentElement.classList.add('dark')
    }
    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showWalletDropdown && !target.closest('.wallet-dropdown-container')) {
        setShowWalletDropdown(false)
      }
    }
    if (showWalletDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showWalletDropdown])

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    localStorage.setItem('darkMode', String(newDarkMode))
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const checkConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = getProvider()
        const accounts = await provider.listAccounts()
        if (accounts.length > 0) {
          const { checkNetwork, switchToArcNetwork } = await import('@/lib/web3')
          const isOnArc = await checkNetwork()
          
          if (!isOnArc) {
            try {
              await switchToArcNetwork()
            } catch (error: any) {
              console.warn('Network switch failed:', error)
              showWarning('Please switch to Arc Testnet in your wallet to use this application.')
            }
          }
          
          setIsConnected(true)
          setAccount(accounts[0].address)
        }
      } catch (error) {
        console.error('Error checking connection:', error)
      }
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setIsConnected(false)
      setAccount(null)
    } else {
      setIsConnected(true)
      setAccount(accounts[0])
    }
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setAccount(null)
  }

  const menuItems = [
    { id: 'fx', label: 'Exchange', icon: ArrowLeftRight, description: 'Swap tokens' },
    { id: 'lending', label: 'Lending', icon: DollarSign, description: 'Lend & borrow' },
    { id: 'capital', label: 'Capital Markets', icon: Building2, description: 'Trade assets' },
    { id: 'payments', label: 'Payments', icon: CreditCard, description: 'Send payments' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-50">
          <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            {/* Logo */}
            <div className="flex items-center px-6 py-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-black dark:bg-black overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="Arc Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">Arc Lending</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">DeFi Platform</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all group relative overflow-hidden
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }
                    `}
                  >
                    <motion.div
                      className={`icon-animated ${isActive ? 'icon-glow' : ''}`}
                      whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.2 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600 dark:text-blue-400 icon-gradient' : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400'}`} />
                    </motion.div>
                    <div className="flex-1 text-left">
                      <div className={`font-medium transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.description}
                      </div>
                    </div>
                    {isActive && (
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                      />
                    )}
                  </motion.button>
                )
              })}
            </nav>

            {/* User Section */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-4">
              {isConnected && account ? (
                <div className="flex items-center space-x-3 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {account.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {account.slice(0, 6)}...{account.slice(-4)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Connected</div>
                  </div>
                </div>
              ) : (
                <ConnectWallet 
                  isConnected={false}
                  account={null}
                  onConnect={() => {
                    setIsConnected(true)
                    checkConnection()
                  }}
                />
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 lg:hidden animate-slide-in">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-black dark:bg-black overflow-hidden">
                      <img 
                        src="/logo.png" 
                        alt="Arc Logo" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">Arc Lending</h1>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                  {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id)
                          setSidebarOpen(false)
                        }}
                        className={`
                          w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all
                          ${isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }
                        `}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    )
                  })}
                </nav>
                <div className="border-t border-slate-200 dark:border-slate-700 p-4">
                  {isConnected && account ? (
                    <div className="flex items-center space-x-3 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {account.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {account.slice(0, 6)}...{account.slice(-4)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Connected</div>
                      </div>
                    </div>
                  ) : (
                    <ConnectWallet 
                      isConnected={false}
                      account={null}
                      onConnect={() => {
                        setIsConnected(true)
                        checkConnection()
                        setSidebarOpen(false)
                      }}
                    />
                  )}
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden lg:pl-64">
          {/* Top Header */}
          <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <motion.button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <Menu className="h-6 w-6 icon-animated" />
                </motion.button>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {menuItems.find(item => item.id === activeTab)?.description || ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <motion.a
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800 button-lift"
                  title="Get testnet USDC and EURC"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Droplet className="h-4 w-4 icon-glow" />
                  </motion.div>
                  <span className="hidden sm:inline">Faucet</span>
                </motion.a>
                <motion.button
                  onClick={toggleDarkMode}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Toggle dark mode"
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  {darkMode ? (
                    <Sun className="h-5 w-5 icon-animated icon-glow" />
                  ) : (
                    <Moon className="h-5 w-5 icon-animated" />
                  )}
                </motion.button>
                {isConnected && account && (
                  <div className="hidden sm:block relative wallet-dropdown-container">
                    <motion.button
                      onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors button-lift"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Wallet className="h-4 w-4 text-slate-500 dark:text-slate-400 icon-glow" />
                      </motion.div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {account.slice(0, 6)}...{account.slice(-4)}
                      </span>
                      <motion.div
                        animate={{ rotate: showWalletDropdown ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      </motion.div>
                    </motion.button>
                    {showWalletDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Connected Wallet</div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white break-all">
                            {account}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            handleDisconnect()
                            setShowWalletDropdown(false)
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!isConnected && (
                  <div className="hidden sm:block">
                    <ConnectWallet 
                      isConnected={false}
                      account={null}
                      onConnect={() => {
                        setIsConnected(true)
                        checkConnection()
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {!isConnected && activeTab !== 'fx' ? (
                <div className="max-w-2xl mx-auto animate-fade-in">
                  <div className="workbird-card p-8">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full workbird-gradient mb-4 shadow-lg">
                        <Wallet className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Connect Your Wallet
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-6">
                        Please connect your wallet to access this feature
                      </p>
                      <ConnectWallet 
                        isConnected={false}
                        account={null}
                        onConnect={() => {
                          setIsConnected(true)
                          checkConnection()
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  {activeTab === 'fx' && <FXTrading account={account!} />}
                  {activeTab === 'lending' && <LendingDashboard account={account!} />}
                  {activeTab === 'capital' && <CapitalMarkets account={account!} />}
                  {activeTab === 'payments' && <Payments account={account!} />}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}
