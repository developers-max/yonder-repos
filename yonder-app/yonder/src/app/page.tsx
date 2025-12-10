"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/app/_components/ui/button";
import { Textarea } from "@/app/_components/ui/textarea";
import { DotPattern } from "@/app/_components/ui/dot-pattern";
import { Magnetic } from "@/app/_components/ui/magnetic";
import { Send, Waves, Mountain, Sprout } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { Marquee } from "@/app/_components/ui/marquee";

export default function Home() {
  const [search, setSearch] = useState("");

  const heroImages = [
    "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/1.png",
    "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/2.png",
    "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/3.png",
    "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/4.png",
    "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/5.png",
    "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/6.png",
  ];

  const suggestions = [
    {
      icon: Waves,
      text: "Find plots near Lisbon under €100k",
    },
    {
      icon: Mountain,
      text: "Show me the full plot acquisition process",
    },
    {
      icon: Sprout,
      text: "Search for plots within 25km of Porto",
    },
  ];

  const howItWorksSteps = [
    {
      title: "Search land",
      description:
        "Type in plain language — 'under €50K near Lisbon with ocean view.' Yonder finds matching plots fast.",
      image:
        "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/hiw-1.png",
      imageAlt: "Search land interface",
    },
    {
      title: "Fill the gaps",
      description:
        "Our AI enriches the missing plot details: zoning, access, permits, services, and more.",
      image:
        "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/hiw-2.png",
      imageAlt: "Find missing data visualization",
    },
    {
      title: "Connect locally",
      description:
        "Get linked to trusted local experts for land checks, permits, and building steps.",
      image:
        "https://lbgsnpwlycvbdvkpcgxp.supabase.co/storage/v1/object/public/public_imgs/landing_page/hiw-3.png",
      imageAlt: "Local experts connection",
    },
  ];

  return (
    <main>
      <header className="sticky top-0 z-20 bg-background border-b border-gray-100 h-18 items-center">
        <div className="mx-auto max-w-7xl px-8 py-4 flex items-center gap-4 justify-between">
          <Link href="/" className="font-semibold">
            <Image src="/logo.svg" alt="Yonder" width={100} height={100} />
          </Link>
          <div className="ml-auto md:ml-6 flex items-center gap-4">
            <Link
              href="/landing/realtor"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              For Realtors
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-full font-semibold text-base h-10 hover:bg-accent"
            >
              Login
            </Link>
            <Link href="/signup">
              <Button className="h-10 px-4 rounded-full font-semibold text-base">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="hero">
        <div className="pt-8 pb-16">
          <Marquee className="pt-10 gap-4" pauseOnHover>
            {heroImages.map((src, i) => (
              <div
                key={`m1-${i}`}
                className="relative h-80 w-64 rounded-xl overflow-hidden"
              >
                <Image
                  src={src}
                  alt="Showcase"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* Build */}
      <section
        id="build"
        className="relative h-[calc(100vh-144px)] min-h-fit py-8 flex items-center justify-center bg-gray-100/50 rounded-3xl md:m-8 m-4 overflow-hidden"
      >
        <DotPattern
          glow={true}
          className={cn(
            "[mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
          )}
        />
        <div className="px-4 relative z-10">
          <div className="text-center">
            <motion.h1
              className="text-4xl md:text-6xl font-bold tracking-normal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              AI for turning <br /> land into real use.
            </motion.h1>
            <motion.p
              className="mt-3 text-muted-foreground max-w-3xl md:text-xl text-base mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Find land, discover missing data like zoning details, and connect
              with local experts through AI-powered search and guidance.
            </motion.p>
          </div>
          {/* Chat Input */}
          <motion.div
            className="mt-10 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="relative rounded-2xl border border-gray-200 bg-white shadow-md p-4 overflow-hidden">
              <Textarea
                placeholder="Describe your land needs..."
                rows={3}
                className="w-full border-0 shadow-none bg-transparent p-0 text-base md:text-base resize-none focus-visible:ring-0 focus-visible:border-transparent min-h-24 rounded-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <div className="text-sm font-light text-gray-400">
                  Enter to send - Shift+Enter for new line
                </div>
                <Link href="/signup">
                  <Button
                    size="sm"
                    className="bg-black text-white rounded-full hover:bg-gray-800 !px-3"
                  >
                    Start search
                    <Send className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <motion.div
              className="mt-4 flex flex-wrap gap-3 justify-center"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.1,
                    delayChildren: 0.3,
                  },
                },
              }}
            >
              {suggestions.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <motion.div
                    key={index}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-100 bg-white hover:bg-gray-100 shadow-none text-gray-600 border rounded-full px-4 py-2 transition-all duration-200"
                      onClick={() => setSearch(suggestion.text)}
                    >
                      <Icon className="w-4 h-4" />
                      {suggestion.text}
                    </Button>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="pb-20 pt-8">
        <motion.div
          className="mx-auto max-w-4xl px-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-semibold">How it works</h2>
          <p className="mt-3 text-xl text-muted-foreground">
            From search to action in three AI-powered steps
          </p>
        </motion.div>

        <div className="mx-auto max-w-4xl px-4 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {howItWorksSteps.map((step, index) => {
              return (
                <div key={step.title} className="flex flex-col gap-3">
                  {/* Image */}
                  <motion.div
                    className="relative h-64 w-full overflow-hidden rounded-xl bg-gray-100/80"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.2 }}
                  >
                    <Image
                      src={step.image}
                      alt={step.imageAlt}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </motion.div>

                  {/* Content */}
                  <Magnetic intensity={0.15} range={150}>
                    <motion.div
                      className="p-3 bg-white flex-1 rounded-lg border border-gray-100"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.2 + 0.1 }}
                    >
                      <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center mb-2">
                        <span className="font-mono text-sm font-bold text-white">
                          0{index + 1}
                        </span>
                      </div>
                      <h3 className="text-base font-bold mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </motion.div>
                  </Magnetic>
                </div>
              );
            })}
          </div>
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
    </main>
  );
}
