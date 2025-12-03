'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose, index }: ToastProps & { index: number }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10)

    // Auto-close after duration
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onClose(toast.id), 300) // Wait for fade out
    }, toast.duration || 5000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(toast.id), 300)
  }

  const icons = {
    success: <CheckCircle2 className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    warning: <AlertTriangle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
  }

  const colors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  }

  const iconColors = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  }

  return (
    <div
      className={`
        relative
        min-w-[320px] max-w-[420px] w-full
        rounded-xl border-2 shadow-lg backdrop-blur-sm
        ${colors[toast.type]}
        transition-all duration-300 ease-out pointer-events-auto
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
      `}
      style={{
        marginTop: `${index * 80}px`,
      }}
    >
      <div className="flex items-start space-x-3 p-4">
        <div className={`flex-shrink-0 ${iconColors[toast.type]}`}>
          {icons[toast.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-relaxed break-words">
            {toast.message}
          </p>
        </div>
        <button
          onClick={handleClose}
          className={`
            flex-shrink-0 p-1 rounded-lg
            hover:bg-black/5 dark:hover:bg-white/5
            transition-colors
            ${iconColors[toast.type]}
          `}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none flex flex-col items-end space-y-2">
      {toasts.map((toast, index) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} index={index} />
      ))}
    </div>
  )
}

