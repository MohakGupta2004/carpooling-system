const steps = [
  {
    number: "01",
    title: "Add your people",
    body: "Invite your team by work email, or point it at your HR system. Everyone sets their pickup point, shift timing, and whether they'd rather drive or ride.",
  },
  {
    number: "02",
    title: "Let it match",
    body: "Each evening Workway works out who's going the same way tomorrow and proposes a few pools. Riders confirm a seat, drivers see the route before they commit.",
  },
  {
    number: "03",
    title: "Costs settle themselves",
    body: "When a trip ends, fuel and toll cost splits between the riders automatically. No spreadsheets, no chasing people for their share on WhatsApp.",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-b border-border/80">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Set up in an afternoon, not a quarter
          </h2>
          <p className="mt-3 text-muted-foreground">
            Most admins have their first pool of colleagues matched before the
            end of their first day on Workway.
          </p>
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <div key={step.number} className="border-t border-border pt-5">
              <span className="text-sm text-secondary">{step.number}</span>
              <h3 className="mt-2 text-lg font-medium text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
