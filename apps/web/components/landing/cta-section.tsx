import Link from "next/link"

import { buttonVariants } from "@repo/ui/button"
import { cn } from "@/lib/utils"

export function CtaSection() {
  return (
    <section id="pricing" className="border-b border-border/80">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl bg-primary px-8 py-14 text-center sm:px-16">
          <h2 className="text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
            Bring it to your commute
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-primary-foreground/80">
            Free for the first 25 commuters on your team. After that, it&apos;s
            priced per active rider, not per seat you hope gets filled.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-background px-6 text-foreground hover:bg-background/90"
              )}
            >
              Start free trial
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              )}
            >
              Talk to us first
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
