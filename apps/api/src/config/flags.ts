/**
 * Feature flags — every differentiator is gated so a broken experimental
 * feature can never take down the mandatory demo path.
 */
export const flags = {
  matchingV2: true,
  routeOptimization: false,
  aiRecommendation: false,
  aiWeeklyReport: false,
  demandPrediction: false,
  fraudDetection: false,
  gamification: true,
  sustainability: true,
  sos: true,
  voiceCall: false,
  pushNotifications: true,
  microsoftAuth: false,
  pwa: true,
  superAdmin: true,
} as const;

export type FeatureFlag = keyof typeof flags;
