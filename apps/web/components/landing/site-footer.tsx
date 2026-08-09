import Link from "next/link"

const columns = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "#platform" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Start free", href: "/register" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                W
              </span>
              <span
                className="text-base font-semibold tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Workway
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              A carpooling network for people who already work together.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-medium text-foreground">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border/80 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Workway. Built for the daily
            commute.
          </p>
          <p>Bengaluru, India</p>
        </div>
      </div>
    </footer>
  )
}
