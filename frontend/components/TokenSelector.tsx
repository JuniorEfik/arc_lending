'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { TOKENS, Token, addCustomToken } from '@/config/tokens'
import { ethers } from 'ethers'

interface TokenSelectorProps {
  value: string
  onChange: (address: string) => void
  label?: string
  showCustomInput?: boolean
  defaultOpen?: boolean
}

export function TokenSelector({ value, onChange, label = 'Select Token', showCustomInput = true, defaultOpen = false }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true)
    }
  }, [defaultOpen])
  const [searchTerm, setSearchTerm] = useState('')
  const [customAddress, setCustomAddress] = useState('')
  const [customSymbol, setCustomSymbol] = useState('')

  const selectedToken = TOKENS.find(t => t.address.toLowerCase() === value.toLowerCase())

  const filteredTokens = TOKENS.filter(token =>
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectToken = (token: Token) => {
    onChange(token.address)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleCustomToken = () => {
    if (customAddress && ethers.isAddress(customAddress)) {
      const customToken = addCustomToken(
        customAddress,
        customSymbol || 'CUSTOM',
        customSymbol || 'Custom Token'
      )
      onChange(customToken.address)
      setIsOpen(false)
      setCustomAddress('')
      setCustomSymbol('')
    }
  }

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-2">
          {label}
        </label>
      )}
      {!defaultOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-between hover:border-primary-500 transition-colors"
        >
          <span>
            {selectedToken ? `${selectedToken.symbol} - ${selectedToken.name}` : 'Select a token'}
          </span>
          <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {isOpen && (
        <div className={`${defaultOpen ? 'relative' : 'absolute'} z-50 w-full ${defaultOpen ? '' : 'mt-2'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-96 overflow-hidden`}>
          {/* Search */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tokens..."
                className="workbird-input w-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Token List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handleSelectToken(token)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    {token.logo ? (
                      <img 
                        src={token.logo} 
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {token.symbol.slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{token.symbol}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                No tokens found
              </div>
            )}
          </div>

          {/* Custom Token Input */}
          {showCustomInput && (
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Or enter custom token address:
              </div>
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="0x..."
                className="workbird-input w-full px-3 py-2 mb-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="Symbol (optional)"
                className="workbird-input w-full px-3 py-2 mb-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleCustomToken}
                disabled={!customAddress || !ethers.isAddress(customAddress)}
                className="workbird-button w-full px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use Custom Token
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

