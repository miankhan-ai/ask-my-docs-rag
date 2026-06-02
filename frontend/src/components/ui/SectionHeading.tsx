import { cn } from './cn'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  center?: boolean
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = true,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(center ? 'text-center mx-auto max-w-2xl' : '', className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-gray-500 leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}
