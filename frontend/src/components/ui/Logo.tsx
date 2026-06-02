import { cn } from './cn'

interface LogoProps {
  className?: string
  size?: number
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-label="Ask My Docs logo"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      {/* Document lines */}
      <rect x="8" y="9" width="12" height="1.5" rx="0.75" fill="white" opacity="0.9" />
      <rect x="8" y="13" width="16" height="1.5" rx="0.75" fill="white" opacity="0.9" />
      <rect x="8" y="17" width="10" height="1.5" rx="0.75" fill="white" opacity="0.9" />
      {/* Citation badge */}
      <circle cx="23" cy="22" r="5" fill="white" />
      <text x="23" y="25.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#4f46e5" fontFamily="Inter, sans-serif">1</text>
    </svg>
  )
}
