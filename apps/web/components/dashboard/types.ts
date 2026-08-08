/**
 * Shapes of the data the dashboard reads from the API.
 * Everything the dashboard renders is described here, so a component file
 * never has to guess what a field is called.
 */

/** One organization row on the platform (super admin) dashboard. */
export interface OrgSummary {
  id: string
  name: string
  status: string
  activeUsers: number
  vehicles: number
  rides: number
  completedTrips: number
  co2SavedKg: number
  avgOccupancy: number
  revenue: number
}

/** GET /reports/org-comparison */
export interface PlatformReport {
  organizations: OrgSummary[]
  totals: {
    organizations: number
    activeUsers: number
    vehicles: number
    completedTrips: number
    co2SavedKg: number
    revenue: number
  }
}

/** GET /reports/analytics */
export interface OrgReport {
  kpis: {
    employees: number
    activeEmployees: number
    adoptionRate: number
    vehicles: number
    verifiedVehicles: number
    totalTrips: number
    activeTrips: number
    cancelledTrips: number
    cancellationRate: number
    revenue: number
    monthRevenue: number
    avgOccupancy: number
    totalDistanceKm: number
    co2SavedKg: number
    fuelSavedL: number
    treesEquivalent: number
    ecoPoints: number
  }
  tripsPerDay: TripsPerDay[]
  tripsByStatus: { status: string; count: number }[]
}

/** One point on the "trips per day" chart. */
export interface TripsPerDay {
  date: string
  trips: number
}

/** GET /admin/vehicles — only the fields the dashboard needs. */
export interface AdminVehicle {
  verification: string
  pendingChanges: unknown | null
}

/** GET /reports/me */
export interface MyReport {
  totalTrips: number
  totalDistanceKm: number
  fuelSavedL: number
  co2SavedKg: number
}

/** GET /reports/sustainability */
export interface SustainabilityReport {
  co2SavedKg: number
  fuelSavedL: number
  treesEquivalent: number
  greenScore: number
}
