"use client"

import { AdminDashboard } from "@/components/dashboard/admin-dashboard"
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard"
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard"
import { useAuth } from "@/stores/auth"

/**
 * One URL, three dashboards. This page only decides which one to show —
 * each dashboard fetches and renders its own data.
 */
export default function DashboardPage() {
  const user = useAuth((state) => state.user)
  const permissions = useAuth((state) => state.permissions)

  const firstName = user?.fullName?.split(" ")[0] ?? "there"

  if (permissions.has("org:manage")) {
    return <SuperAdminDashboard name={firstName} />
  }

  if (permissions.has("analytics:view")) {
    return (
      <AdminDashboard name={firstName} orgName={user?.organization?.name} />
    )
  }

  return <EmployeeDashboard name={firstName} />
}
