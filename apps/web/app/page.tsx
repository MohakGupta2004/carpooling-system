import { SiteHeader } from "@/components/landing/site-header"
import { HeroSection } from "@/components/landing/hero-section"
import { StatsSection } from "@/components/landing/stats-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { TestimonialSection } from "@/components/landing/testimonial-section"
import { CtaSection } from "@/components/landing/cta-section"
import { SiteFooter } from "@/components/landing/site-footer"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main>
        <HeroSection />
        <StatsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <TestimonialSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  )
}
