import { Button } from "@/app/_components/ui/button"
import { Card, CardContent } from "@/app/_components/ui/card"
import {
  CheckCircle2,
  FileText,
  MapPin,
  Bell,
  Lock,
  Clock,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  Landmark,
  Scale,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { PublicHeader } from "@/app/_components/public-header"

export default function ForRealtorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#1a1f2e] rounded-2xl p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Left side - Text content */}
              <div className="text-white">
                <h1 className="text-2xl md:text-3xl font-bold mb-4">Claim your plot</h1>
                <p className="text-gray-300 text-sm md:text-base mb-6 leading-relaxed">
                  Add the real location in private and unlock AI reports for your buyers. Use your Yonder link anywhere
                  — fewer questions, less back-and-forth, faster sale.
                </p>
                <Link href="/realtor">
                  <Button
                    size="lg"
                    className="bg-[#ff6b54] hover:bg-[#ff5a42] text-white gap-2 rounded-full px-8 w-full md:w-auto"
                  >
                    <Sparkles className="h-4 w-4" />
                    Claim plot
                  </Button>
                </Link>
              </div>

              {/* Right side - Image with floating badges */}
              <div className="relative">
                <div className="relative rounded-xl overflow-hidden">
                  <Image
                    src="/landscape/spanish-building-land-plot-with-trees-sunny.jpg"
                    alt="Land plot"
                    width={500}
                    height={320}
                    className="w-full h-[260px] md:h-[280px] object-cover rounded-xl"
                  />
                </div>

                {/* Floating badges */}
                <div className="absolute top-4 right-4 bg-white rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#1a1f2e]" />
                  <span className="text-sm font-medium text-[#1a1f2e]">PDM</span>
                </div>

                <div className="absolute bottom-16 -left-3 bg-white rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
                  <Scale className="h-4 w-4 text-[#1a1f2e]" />
                  <span className="text-sm font-medium text-[#1a1f2e]">Zoning</span>
                </div>

                <div className="absolute bottom-4 right-4 bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 border border-[#ff6b54]">
                  <Landmark className="h-4 w-4 text-[#ff6b54]" />
                  <span className="text-sm font-medium text-[#ff6b54]">Cadastre</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">1. Share Location Privately</h3>
                <p className="text-sm text-muted-foreground">
                  Share your plot's exact coordinates with us. We never publish the location publicly.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">2. We Generate Reports</h3>
                <p className="text-sm text-muted-foreground">
                  We pull data from cadastre, zoning (PDM), and building regulations automatically.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">3. Get Notified</h3>
                <p className="text-sm text-muted-foreground">
                  Receive alerts when buyers unlock reports. Know who's seriously interested.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Why Verify Your Plot?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Less Back-and-Forth</h3>
                <p className="text-sm text-muted-foreground">
                  Buyers get answers to zoning, buildability, and regulations upfront. Fewer repetitive questions for
                  you.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Clock className="h-6 w-6 text-blue-600 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Faster Sales Cycle</h3>
                <p className="text-sm text-muted-foreground">
                  Informed buyers make quicker decisions. Reduce time from inquiry to offer.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Users className="h-6 w-6 text-purple-600 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Qualified Leads</h3>
                <p className="text-sm text-muted-foreground">
                  Buyers who unlock reports are serious. Focus your time on real prospects.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <TrendingUp className="h-6 w-6 text-orange-600 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Showcase Potential</h3>
                <p className="text-sm text-muted-foreground">
                  AI reports highlight what can be built, helping buyers visualize the opportunity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data We Provide */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-4">Data We Unlock</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            With verified coordinates, we access official sources to provide comprehensive land data.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <MapPin className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Cadastre</h3>
                <p className="text-xs text-muted-foreground">Official parcel boundaries, area, and ownership records</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <FileText className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">PDM / Zoning</h3>
                <p className="text-xs text-muted-foreground">Municipal development plans and land use classification</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Sparkles className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Building Rules</h3>
                <p className="text-xs text-muted-foreground">
                  Height limits, setbacks, density, and construction parameters
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Sparkles className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">AI Report</h3>
                <p className="text-xs text-muted-foreground">
                  Smart analysis of buildability and development potential
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Verify Your Plot?</h2>
          <p className="text-muted-foreground mb-8">
            It only takes a few minutes. Share your plot's location and let us handle the rest.
          </p>
          <Link href="/realtor">
            <Button size="lg" className="gap-2 bg-[#ff6b54] hover:bg-[#ff5a42]">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-3 text-sm">
          <div>
            <div className="font-semibold">Yonder ©</div>
            <ul className="mt-2 space-y-2 text-muted-foreground flex gap-4">
              <li>
                <a
                  href="https://www.linkedin.com/company/liveyonder/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/liveyonderco/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} Yonder</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
