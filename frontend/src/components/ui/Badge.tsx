import type { ReactNode } from 'react'
import { cn } from './cn'

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

const VARIANTS: Record<BadgeVariant, string> = {
  primary: 'bg-primary-50 text-primary-700 ring-1 ring-primary-100',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  danger: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  neutral: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
}

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: ReactNode
}

export function Badge({ variant = 'primary', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
