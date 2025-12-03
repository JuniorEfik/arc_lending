'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface AnimatedIconProps {
  icon: LucideIcon | ReactNode
  size?: number | string
  className?: string
  animate?: 'hover' | 'pulse' | 'float' | 'bounce' | 'spin' | 'none'
  gradient?: boolean
  glow?: boolean
}

export function AnimatedIcon({
  icon: Icon,
  size = 20,
  className = '',
  animate = 'hover',
  gradient = false,
  glow = false,
}: AnimatedIconProps) {
  const IconComponent = Icon as LucideIcon

  const animationClass = animate !== 'none' ? `icon-${animate}` : ''
  const gradientClass = gradient ? 'icon-gradient' : ''
  const glowClass = glow ? 'icon-glow' : ''

  const iconVariants = {
    hover: {
      scale: 1.15,
      rotate: [0, -5, 5, -5, 0],
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
    pulse: {
      scale: [1, 1.2, 1],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
    },
    float: {
      y: [0, -8, 0],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
    bounce: {
      y: [0, -6, 0],
      scale: [1, 1.1, 1],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
    },
    spin: {
      rotate: 360,
      transition: { duration: 2, repeat: Infinity, ease: 'linear' },
    },
  }

  const iconContent = IconComponent ? (
    <IconComponent size={size} className={`${className} ${gradientClass} ${glowClass}`} />
  ) : (
    <>{Icon}</>
  )

  if (animate === 'none') {
    return <span className={`icon-animated ${className}`}>{iconContent}</span>
  }

  return (
    <motion.div
      className={`icon-animated ${animationClass} ${gradientClass} ${glowClass}`}
      variants={iconVariants}
      initial="initial"
      whileHover={animate === 'hover' ? 'hover' : undefined}
      animate={animate !== 'hover' ? animate : undefined}
      style={{ display: 'inline-flex' }}
    >
      {iconContent}
    </motion.div>
  )
}

