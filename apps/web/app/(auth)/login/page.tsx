"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { useAuth, type Me } from "@/stores/auth"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import {
  CarIcon,
  RouteIcon,
  UsersIcon,
  EcoIcon,
  MailIcon,
  LockIcon,
  SpinnerIcon,
  EyeIcon,
  EyeOffIcon,
} from "@repo/ui/icons"

// Specific and checkable, not aspirational. "Reduce your carbon footprint" was
// the eco-brand reflex; the impact belongs in a figure on the dashboard, not as
// a mood on the sign-in screen.
const features = [
  {
    icon: RouteIcon,
    text: "Matched on route overlap and shift timing, not just your office address",
  },
  {
    icon: CarIcon,
    text: "Drivers see the full route and detour before committing to a pickup",
  },
  {
    icon: UsersIcon,
    text: "Everyone joins with a verified work email — no strangers in the car",
  },
  {
    icon: EcoIcon,
    text: "Fuel and tolls split automatically the moment a trip ends",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const setSession = useAuth((s) => s.setSession)
  const [email, setEmail] = useState("mohak@odoo.com")
  const [password, setPassword] = useState("Password123!")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; user: Me }>(
        "/auth/login",
        { email, password }
      )
      await setSession(res.accessToken, res.user)
      toast.success(`Welcome back, ${res.user.fullName.split(" ")[0]}`)
      router.replace("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/*
        A flat primary slab, not a gradient. The previous version was the
        stock B2B-SaaS auth screen: diagonal gradient, three floating
        translucent circles, frosted-glass icon tiles, an aspirational pull
        quote. All of it decoration, none of it information.

        What replaces it says something a prospective user can act on: the
        three things the product actually does, and the constraint that makes
        it credible. Colour is committed rather than blended.
      */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 lg:flex">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary-foreground/15">
            <CarIcon className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-primary-foreground">
            Workway
          </span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold text-primary-foreground">
            Your colleagues are already driving your route.
          </h2>

          <ul className="mt-10 space-y-5">
            {features.map((feat) => (
              <li key={feat.text} className="flex items-start gap-3">
                <feat.icon className="mt-0.5 size-4 shrink-0 text-primary-foreground/60" />
                <span className="text-sm leading-relaxed text-primary-foreground/85">
                  {feat.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-foreground/60">
          Free for the first 25 commuters. Priced per active rider after that.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary/10">
                <CarIcon className="size-5 text-primary" />
              </div>
              <span className="text-xl font-semibold text-foreground">
                Workway
              </span>
            </Link>
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your Workway account
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <div className="relative">
                <MailIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-9"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <LockIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 pl-9"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading && <SpinnerIcon className="size-4 animate-spin" />}
                Sign in
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Accounts are provisioned by your company admin.
          </p>

          {/* Demo accounts */}
          <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-foreground">
              Demo credentials
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Password:{" "}
              <span className="font-medium text-foreground">Password123!</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                mohak@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-secondary" />
                pramit@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary/60" />
                dia@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-secondary/60" />
                shubhodeep@odoo.com
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
