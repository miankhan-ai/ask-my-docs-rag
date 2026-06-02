import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-soft',
  secondary: 'bg-white text-primary-700 border border-primary-200 hover:bg-primary-50',
  ghost: 'text-gray-600 hover:bg-gray-100',
  outline: 'border border-gray-300 text-gray-700 hover:border-primary-400 hover:text-primary-700',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant, size, className, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </button>
  )
}

interface LinkButtonProps {
  to: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

/** A router <Link> styled as a button. */
export function LinkButton({ to, variant, size, className, children }: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  )
}
