/** Tiny className joiner — filters falsy values and joins with spaces. */
export const cn = (...classes: Array<string | false | undefined | null>): string =>
  classes.filter(Boolean).join(' ')
