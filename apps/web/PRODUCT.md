# Product

## Register

brand

The marketing surface (`app/page.tsx` and `components/landing/*`) is the primary
register: it has to convince a facilities or HR lead that this is worth rolling
out. Everything under `app/(app)/*` and `app/(auth)/*` is product UI and inherits
the brand's palette and typography as a constraint, but is judged by the product
bar — earned familiarity, restrained colour, consistent component vocabulary.
When a task targets an authenticated screen, read the product register.

## Users

Two audiences on one system.

**Commuters** — employees at a company that has rolled Workway out. They open it
on a phone, usually the evening before or in the ten minutes before leaving. They
are not power users and will not read documentation. The job: find a colleague
going my way tomorrow, confirm a seat, and not think about money afterwards.

**Admins** — HR, facilities, or transport leads. Desktop, during the workday,
inside a spreadsheet-and-email workflow. The job: prove adoption, control cost,
verify vehicles and drivers, and answer "is this programme working?" with a number
they can forward.

## Product Purpose

Workway matches people at the same company who commute the same way, splits fuel
and toll costs automatically at the end of each trip, and keeps a record of every
ride for the organisation. It exists because the coordination cost — who's going
my way, what do I owe you — is what kills informal carpooling, not willingness.

Success: a commuter stops driving alone without having to organise anything, and
an admin can show the reduction without building a spreadsheet.

## Brand Personality

**Practical, civic, unfussy.**

It reads like good transit signage: legible, honest, quietly institutional. It
states what it does and what it costs. It does not sell a lifestyle, does not
congratulate the user for existing, and does not describe the commute as a
journey. Confidence comes from specificity — real numbers, real constraints,
named limitations — not from adjectives.

Copy is plain and declarative. Contractions are fine. Exclamation marks are not.

## Anti-references

Four lanes this must not land in:

- **Generic B2B SaaS.** Gradient mesh hero, dashboard screenshot floating at an
  angle, logo cloud, "Trusted by", three identical rounded-icon feature cards.
- **Consumer ride-hailing.** Uber/Ola language — map-as-hero, black-and-white
  people photography, big pill CTAs stacked aggressively.
- **Eco / green-tech.** Leaf motifs, forest-green-on-cream, hand-drawn
  illustration, sunlit-field stock photography. Eco impact is a number here, not
  a mood. (The existing leaf brand mark and `--eco` status colour are the ceiling,
  not a starting point.)
- **Editorial / magazine.** Display serif italic headline, mono metadata labels,
  ruled column separators, no imagery. A currently-saturated AI lane.

## Design Principles

1. **Say the number.** Wherever a claim could be a figure, it is a figure. "₹2,100
   saved monthly" over "significant savings". This is the brand's main source of
   credibility, and it's what the admin forwards upward.

2. **Decoration must earn its place.** An accent rule, a coloured stripe, a
   gradient, a tinted chip — each has to encode something. If removing it loses no
   information, it was never design. Applied to every page uniformly, it is
   scaffolding, not voice.

3. **One vocabulary across both registers.** The landing and the app share the
   same buttons, the same radii, the same neutral ramp. A visitor who signs up
   should recognise the product they were shown. This is also the cheapest way to
   look considered.

4. **Honest interface as imagery.** The product mock is the hero image. It shows
   the real thing rather than a stylised abstraction of it, which fits a brand
   whose whole argument is "this is unglamorous and it works".

5. **State is never colour alone.** Ride status, verification, trip state — each
   carries a shape, an icon, or a word alongside the hue. Required for
   accessibility, and it survives a forwarded screenshot in greyscale.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA.**

- Body text ≥4.5:1; large text (≥18px, or bold ≥14px) and UI component boundaries
  ≥3:1. Placeholder text is held to the body-text ratio, not a muted default.
- Visible, non-default focus indicators on every interactive element.
- `prefers-reduced-motion: reduce` honoured everywhere — transitions collapse to
  instant or a crossfade, never removed to the point that state change becomes
  invisible.
- Employees may be required to use this as a condition of a commuting benefit, so
  it cannot assume a mouse, a large screen, or good ambient light. Phone-first for
  everything under `(app)`.
