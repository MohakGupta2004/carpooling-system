"use client"

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

interface RazorpayOrderInfo {
  orderId: string
  amount: number
  currency: string
  keyId: string
  prefillEmail?: string
  /** present when the gateway isn't configured and the server credited directly */
  fallback?: boolean
}

export interface CheckoutResult {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void
      on?: (
        event: string,
        handler: (response: { error?: { description?: string } }) => void
      ) => void
    }
  }
}

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve(true))
      return
    }
    const s = document.createElement("script")
    s.src = CHECKOUT_SRC
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

/**
 * Open Razorpay Checkout for a created order. Resolves with the verification
 * payload on success, rejects if the user dismisses or the script fails.
 */
export async function openCheckout(
  order: RazorpayOrderInfo,
  name = "WorkWay"
): Promise<CheckoutResult> {
  const ok = await loadScript()
  if (!ok || !window.Razorpay) throw new Error("Could not load payment gateway")

  // Test keys accept the magic VPA "success@razorpay" (always succeeds) and
  // "failure@razorpay" (fails). Prefill the success VPA so, once the user picks
  // UPI → "Enter UPI ID", the test ID is already filled — just tap Pay.
  const isTest = order.keyId.startsWith("rzp_test_")

  return new Promise<CheckoutResult>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name,
      description: "Enterprise carpooling",
      prefill: {
        ...(isTest ? { method: "upi", vpa: "success@razorpay" } : {}),
        ...(order.prefillEmail ? { email: order.prefillEmail } : {}),
      },
      theme: { color: "#0d9488" },
      // Success: Razorpay fires this once the UPI/card payment completes. The
      // caller then hits /payments/verify to confirm the signature server-side.
      handler: (res: CheckoutResult) => resolve(res),
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
    })
    // Surface real gateway errors (e.g. failure@razorpay) instead of hanging.
    rzp.on?.("payment.failed", (resp: { error?: { description?: string } }) =>
      reject(new Error(resp?.error?.description ?? "Payment failed"))
    )
    rzp.open()
  })
}

export type { RazorpayOrderInfo }
