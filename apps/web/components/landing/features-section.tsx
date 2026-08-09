const features = [
  {
    title: "Route matching",
    body: "Matches riders and drivers by actual route overlap and shift timing, not just the same office building.",
  },
  {
    title: "Automatic cost splitting",
    body: "Fuel and tolls are worked out per trip and settled into everyone's wallet — no one has to send a reminder.",
  },
  {
    title: "Verified profiles",
    body: "Company email or SSO to join, two-way ratings after every trip, and a full history of who rode with whom.",
  },
  {
    title: "Live trip tracking",
    body: "Riders can see the car on the map and share the trip with a family member, the same way they would with any ride app.",
  },
  {
    title: "Admin reports",
    body: "Adoption, parking demand, and cost per commuter, exportable for whoever asked you to prove the programme is working.",
  },
  {
    title: "Calendar aware",
    body: "Reads shift changes and work-from-home days so it stops proposing a ride for someone who isn't coming in.",
  },
]

export function FeaturesSection() {
  return (
    <section id="platform" className="border-b border-border/80">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Everything the commute needs, nothing it doesn&apos;t
          </h2>
          <p className="mt-3 text-muted-foreground">
            We built the parts a facilities or HR team actually asks for, and
            left out the rest.
          </p>
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {/* No numbers here: these are six parallel capabilities, not a
              sequence. Numbering them would duplicate the how-it-works
              treatment, where the order actually carries meaning. */}
          {features.map((feature) => (
            <div key={feature.title}>
              <h3 className="text-base font-medium text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
