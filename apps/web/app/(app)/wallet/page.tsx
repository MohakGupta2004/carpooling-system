"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { openCheckout, type RazorpayOrderInfo } from "@/lib/razorpay"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { WalletIcon } from "@repo/ui/icons"

interface Wallet {
  balance: number
}
interface Txn {
  id: string
  type: string
  amount: number
  balanceAfter: number
  note: string | null
  createdAt: string
}

export default function WalletPage() {
  const qc = useQueryClient()
  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<Wallet>("/wallet"),
  })
  const txns = useQuery({
    queryKey: ["wallet", "txns"],
    queryFn: () => api.get<Txn[]>("/wallet/transactions"),
  })

  const recharge = useMutation({
    mutationFn: async (amount: number) => {
      const order = await api.post<RazorpayOrderInfo>(
        "/wallet/recharge/order",
        { amount }
      )
      if (order.fallback) return // gateway off — server credited directly (dev)
      const result = await openCheckout(order, "WorkWay Wallet")
      await api.post("/wallet/recharge/verify", {
        orderId: result.razorpay_order_id,
        paymentId: result.razorpay_payment_id,
        signature: result.razorpay_signature,
      })
    },
    onSuccess: () => {
      toast.success("Wallet recharged")
      qc.invalidateQueries({ queryKey: ["wallet"] })
      qc.invalidateQueries({ queryKey: ["wallet", "txns"] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Recharge failed"),
  })

  return (
    <div>
      <PageHeader
        title="Wallet"
        description="Recharge and pay for rides seamlessly."
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <WalletIcon className="size-5" /> Balance
            </div>
            <p className="tabular mt-2 text-4xl font-semibold">
              {inr(wallet.data?.balance ?? 0)}
            </p>
            <div className="mt-5 flex gap-2">
              {[500, 1000, 2000].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => recharge.mutate(amt * 100)}
                  disabled={recharge.isPending}
                >
                  +₹{amt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">
              Transactions
            </div>
            <div className="divide-y divide-border">
              {txns.data?.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{t.note ?? t.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`tabular text-sm font-semibold ${t.amount >= 0 ? "text-[var(--success)]" : "text-destructive"}`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {inr(t.amount)}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {inr(t.balanceAfter)}
                    </Badge>
                  </div>
                </div>
              ))}
              {txns.data?.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
