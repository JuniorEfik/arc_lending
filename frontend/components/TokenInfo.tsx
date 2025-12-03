'use client'

import { useState, useEffect } from 'react'
import { Info, AlertCircle } from 'lucide-react'
import { getTokenInfo, getERC20 } from '@/lib/web3'
import { ethers } from 'ethers'

interface TokenInfoProps {
  address: string
}

export function TokenInfo({ address }: TokenInfoProps) {
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; name: string; decimals: number } | null>(null)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!address || !ethers.isAddress(address)) {
      setIsValid(false)
      setTokenInfo(null)
      return
    }

    const checkToken = async () => {
      setIsLoading(true)
      try {
        // Try to get token info - if decimals() works, token is valid
        try {
          const info = await getTokenInfo(address)
          setTokenInfo(info)
          setIsValid(true)
        } catch (error: any) {
          console.error('getTokenInfo failed:', error)
          // If getTokenInfo fails, try to validate by calling balanceOf with a test address
          try {
            const token = getERC20(address)
            // Use zero address as test - balanceOf should work even if balance is 0
            const testAddress = '0x0000000000000000000000000000000000000000'
            await token.balanceOf(testAddress)
            // If balanceOf works, token is valid but info fetch failed
            setIsValid(true)
            // Try to get decimals at least
            let decimals = 18
            const isUSDC = address.toLowerCase() === '0x3600000000000000000000000000000000000000'
            if (isUSDC) {
              decimals = 6
            } else {
              try {
                decimals = await token.decimals()
              } catch {
                decimals = 18
              }
            }
            setTokenInfo({ symbol: 'UNKNOWN', name: 'Unknown Token', decimals })
          } catch (validateError: any) {
            console.error('Token validation failed:', validateError)
            setIsValid(false)
            setTokenInfo(null)
          }
        }
      } catch (error) {
        console.error('Token check error:', error)
        setIsValid(false)
        setTokenInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkToken()
  }, [address])

  if (!address || !ethers.isAddress(address)) {
    return null
  }

  if (isLoading) {
    return (
      <div className="text-xs text-slate-900 dark:text-white/70">
        Validating token...
      </div>
    )
  }

  if (isValid === false) {
    return (
      <div className="flex items-center space-x-2 text-xs text-red-600 dark:text-red-400 mt-1">
        <AlertCircle className="h-4 w-4" />
        <span>Invalid token address or contract not found</span>
      </div>
    )
  }

  if (tokenInfo && isValid) {
    // Show token info - if symbol/name are unknown, show a cleaner message
    if (tokenInfo.symbol === 'UNKNOWN' && tokenInfo.name === 'Unknown Token') {
      return (
        <div className="flex items-center space-x-2 text-xs text-slate-900 dark:text-white/80 mt-1">
          <Info className="h-4 w-4" />
          <span>Valid ERC20 token - {tokenInfo.decimals} decimals</span>
        </div>
      )
    }
    
    return (
      <div className="flex items-center space-x-2 text-xs text-slate-900 dark:text-white/80 mt-1">
        <Info className="h-4 w-4" />
        <span>{tokenInfo.name} ({tokenInfo.symbol}) - {tokenInfo.decimals} decimals</span>
      </div>
    )
  }

  return null
}

