export function TestimonialSection() {
  return (
    <section className="border-b border-border/80 bg-muted/40">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p
          className="text-2xl leading-snug font-medium text-foreground sm:text-3xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          &ldquo;Parking demand at our Manyata office dropped enough that we
          shelved a planned lot expansion. It paid for itself before we even ran
          the numbers.&rdquo;
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            RS
          </span>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Rekha Shastri</p>
            <p className="text-xs text-muted-foreground">
              Facilities Lead, a 1,200-person tech campus in Bengaluru
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
