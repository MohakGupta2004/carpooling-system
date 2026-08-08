/** Tunable constants for sustainability math (India defaults). See docs/07. */
export const SUSTAINABILITY = {
  FUEL_EFFICIENCY_KMPL: 15,
  /**
   * Tailpipe CO2 emission factor per litre of fuel (grams), by fuel type.
   * Petrol 2.31 kg/L and Diesel 2.67 kg/L are the standard tailpipe factors.
   * CNG/HYBRID are approximations — tune per local grid/fuel data.
   * ponytail: flat per-fuel factors, add well-to-wheel/lifecycle if a real LCA is needed.
   */
  CO2_PER_LITRE_G: {
    PETROL: 2310,
    DIESEL: 2670,
    CNG: 2160,
    HYBRID: 2310,
  } as Record<string, number>,
  CO2_PER_TREE_YEAR_G: 21000,
  PETROL_PRICE_PER_L: 105,
  // EV
  EV_EFFICIENCY_KM_PER_KWH: 6,
  CO2_PER_KWH_G: 700, // grid factor
} as const;
