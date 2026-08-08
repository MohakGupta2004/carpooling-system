"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Badge } from "@repo/ui/badge"
import { Button } from "@repo/ui/button"
import { Skeleton } from "@repo/ui/skeleton"

interface HistoryItem {
  id: string
  status: string
  fareAmount: number
  payment: { method: string; status: string } | null
  ride: {
    originLabel: string
    destLabel: string
    driver: { fullName: string }
    vehicle: { brand: string; model: string }
    trip: { id: string; completedAt: string | null } | null
  }
}

export default function HistoryPage() {
  const history = useQuery({
    queryKey: ["history"],
    queryFn: () => api.get<HistoryItem[]>("/history"),
  })

  return (
    <div>
      <PageHeader
        title="Ride History"
        description="All your completed and cancelled trips."
      />
      {history.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {history.data?.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {h.ride.originLabel} → {h.ride.destLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.ride.driver.fullName} · {h.ride.vehicle.brand}{" "}
                    {h.ride.vehicle.model}
                    {h.ride.trip?.completedAt &&
                      ` · ${new Date(h.ride.trip.completedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {h.payment && (
                    <Badge variant="outline">{h.payment.method}</Badge>
                  )}
                  <Badge
                    variant={
                      h.status === "COMPLETED" ? "success" : "destructive"
                    }
                  >
                    {h.status}
                  </Badge>
                  <span className="tabular text-sm font-semibold">
                    {inr(h.fareAmount)}
                  </span>
                  {h.ride.trip && (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/trips/${h.ride.trip.id}`}>
                        View details
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {history.data?.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No history yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
