"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, type Variants } from "motion/react"
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

const container: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
}

const features = [
  { icon: CarIcon, text: "Share rides with colleagues" },
  { icon: RouteIcon, text: "Optimized daily routes" },
  { icon: UsersIcon, text: "Company-wide carpool network" },
  { icon: EcoIcon, text: "Reduce your carbon footprint" },
]

export default function LoginPage() {
  const router = useRouter()
  const setSession = useAuth((s) => s.setSession)
  const [email, setEmail] = useState("ankit@odoo.com")
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
      {/* Left panel — brand gradient with features */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-secondary p-12 lg:flex lg:flex-col lg:justify-between">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 size-64 rounded-full bg-white/5" />
        <div className="absolute -right-32 -bottom-32 size-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/3 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.03]" />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <CarIcon className="size-5 text-white" />
            </div>
            <span
              className="text-xl font-semibold text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Carpool
            </span>
          </Link>
        </motion.div>

        {/* Tagline & features */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-md"
        >
          <motion.h2
            variants={item}
            className="text-4xl leading-tight font-semibold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Commute smarter,
            <br />
            together.
          </motion.h2>
          <motion.p variants={item} className="mt-4 text-base text-white/70">
            Join your company&apos;s carpool network and make every commute
            count.
          </motion.p>

          <div className="mt-10 space-y-4">
            {features.map((feat, i) => (
              <motion.div
                key={feat.text}
                variants={item}
                custom={i}
                className="flex items-center gap-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <feat.icon className="size-4 text-white" />
                </div>
                <span className="text-sm text-white/80">{feat.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10 text-xs text-white/50"
        >
          &ldquo;The best carpool is the one you don&apos;t have to drive
          alone.&rdquo;
        </motion.p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="mx-auto w-full max-w-sm"
        >
          {/* Mobile logo */}
          <motion.div variants={item} className="mb-10 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <CarIcon className="size-5 text-primary" />
              </div>
              <span
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Carpool
              </span>
            </Link>
          </motion.div>

          <motion.div variants={item}>
            <h1
              className="text-3xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your carpool account
            </p>
          </motion.div>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            <motion.div variants={item} className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <div className="relative">
                <MailIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border border-border bg-background pl-9 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </motion.div>

            <motion.div variants={item} className="space-y-2">
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
                  className="h-11 rounded-lg border border-border bg-background pr-10 pl-9 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
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
            </motion.div>

            <motion.div variants={item} className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full py-4 text-lg text-white"
                disabled={loading}
              >
                {loading && <SpinnerIcon className="size-4 animate-spin" />}
                Sign in
              </Button>
            </motion.div>
          </form>

          <motion.p
            variants={item}
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            Accounts are provisioned by your company admin.
          </motion.p>

          {/* Demo accounts */}
          <motion.div
            variants={item}
            className="mt-8 rounded-2xl border border-border bg-muted/30 p-4"
          >
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
                ankit@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-secondary" />
                priya@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary/60" />
                jaanvi@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-secondary/60" />
                raj@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary/40" />
                meera@odoo.com
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-secondary/40" />
                sahil@odoo.com
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
