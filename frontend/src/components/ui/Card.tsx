import type { HTMLAttributes } from 'react'
import { cn } from './cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-card border border-gray-100',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
