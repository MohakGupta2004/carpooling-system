import Link from "next/link"

import { buttonVariants } from "@repo/ui/button"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            W
          </span>
          <span className="text-base font-semibold tracking-tight">
            Workway
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ size: "sm" }), "px-4")}
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  )
}
