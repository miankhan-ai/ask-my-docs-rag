/** Shared framer-motion variants for landing page sections. */

export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: 'easeOut' },
} as const

export const fadeUpDelay = (i: number) => ({
  ...fadeUp,
  transition: { duration: 0.5, ease: 'easeOut', delay: i * 0.08 },
})

export const heroEntrance = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
} as const

export const heroEntranceDelay = (i: number) => ({
  ...heroEntrance,
  transition: { duration: 0.5, ease: 'easeOut', delay: 0.1 + i * 0.1 },
})
