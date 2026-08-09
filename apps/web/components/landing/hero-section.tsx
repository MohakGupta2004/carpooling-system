import Link from "next/link"

import { buttonVariants } from "@repo/ui/button"
import { cn } from "@/lib/utils"

export function HeroSection() {
  return (
    <section className="border-b border-border/80">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-28">
        <div>
          <span className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            Now rolling out to Bengaluru offices
          </span>

          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-tight text-foreground sm:text-5xl">
            Your colleagues are already
            <br />
            driving your route.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Workway pairs people at the same company who commute the same way,
            splits the fuel bill automatically, and keeps a record of every trip
            for HR and admin. No new app to convince people to download —
            it&apos;s already the one they use to book a ride.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }), "px-6")}
            >
              Get started for your team
            </Link>
            <a
              href="#how-it-works"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-6"
              )}
            >
              See how it works
            </a>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Free for the first 25 commuters. No procurement call required.
          </p>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 pb-3 text-xs text-muted-foreground">
              <span>Tomorrow, 8:15 AM</span>
              <span>HSR Layout → Manyata Tech Park</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Priya M. is driving
                  </p>
                  <p className="text-xs text-muted-foreground">
                    3 seats left · Sector 2, HSR
                  </p>
                </div>
                <span className="text-sm font-medium text-foreground">₹42</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Arjun K. requested a seat
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pickup on the way, +6 min detour
                  </p>
                </div>
                <span className="text-xs text-secondary">Confirmed</span>
              </div>

              <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                Cost splits automatically when the trip ends. Your share lands
                in your Workway wallet.
              </div>
            </div>
          </div>

          <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:block">
            <p className="text-lg font-semibold text-foreground">₹1,860</p>
            <p className="text-xs text-muted-foreground">saved this month</p>
          </div>
        </div>
      </div>
    </section>
  )
}
