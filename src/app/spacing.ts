/**
 * Shared spacing scale (4px base unit grid).
 * Import these constants instead of hardcoding pixel values.
 */
export const spacing = {
  /** 4px — very tight, between closely related elements */
  xs: 4,
  /** 8px — small gaps, list item vertical margins */
  sm: 8,
  /** 12px — medium gaps, form element spacing */
  md: 12,
  /** 16px — standard container padding, primary section gap */
  base: 16,
  /** 24px — large section separation */
  lg: 24,
  /** 32px — extra large, emphasis areas */
  xl: 32,
} as const;

/** Border radius tokens following MD3 shape scale. */
export const radius = {
  /** 8px — small elements, chips */
  sm: 8,
  /** 12px — standard cards, surfaces */
  md: 12,
  /** 16px — modals, bottom sheets */
  lg: 16,
} as const;
