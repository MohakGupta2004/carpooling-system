const stats = [
  { value: "34%", label: "fewer solo drives after 3 months" },
  { value: "₹2,100", label: "average saved per commuter, monthly" },
  { value: "9,400+", label: "trips logged across pilot teams" },
  { value: "4.7 / 5", label: "average rating drivers give riders" },
]

export function StatsSection() {
  return (
    <section className="border-b border-border/80">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-border/80 border-border/80 px-6 md:grid-cols-4 md:divide-y-0">
        {stats.map((stat) => (
          <div key={stat.label} className="px-4 py-8 first:pl-0 sm:px-6">
            <p
              className="text-2xl font-semibold text-foreground sm:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
