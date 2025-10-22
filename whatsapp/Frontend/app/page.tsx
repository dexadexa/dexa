"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { ChatScene } from "@/components/chat-scene"
import { useRef } from "react"
import { Feature } from "@/components/feature"

export default function HomePage() {
  const { scrollYProgress } = useScroll()
  const bgOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.85])
  const storyRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress: storyProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"],
  })

  return (
    <main className="min-h-screen bg-[#0B141A] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-[#0B141A]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="DeXa Hedera Last Mile Access Logo"
              className="size-8 object-contain"
            />
            <span className="text-sm font-medium tracking-wide text-white/90">DeXa Hedera Last Mile Access</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#story" className="hover:text-white">
              Story
            </a>
            <a href="#features" className="hover:text-white">
              Features
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <motion.div
          style={{ opacity: bgOpacity }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,211,102,0.15),_transparent_60%)]"
          aria-hidden
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/80">
              <span className="size-1.5 rounded-full bg-[#25D366]" />
              Built on Hedera (EVM) • Inside WhatsApp
            </span>
            <h1 className="text-pretty text-4xl font-semibold leading-[1.1] md:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-[#25D366] to-[#1FC65C] bg-clip-text text-transparent">
                Hedera EVM
              </span>
              <br />
              💬 Living Inside WhatsApp 
            </h1>
            <p className="text-pretty text-sm leading-relaxed text-white/70 md:text-base">
              {/* The world's first <strong className="text-[#25D366]">Aptos-powered AI agent</strong> that lives natively inside WhatsApp chat.
              <br /> */}
              <br />
              <strong className="text-[#25D366]">Bringing 2 billion WhatsApp users to Hedera.</strong>
              <br />
              • Send HBAR • 🍕 Split bills • 🔒 Secure escrows — all through simple text messages.
              <br />
              <span className="text-white/90">No apps to download. No wallets to manage. Just pure blockchain magic in your favorite chat.</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#story"
                className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-black hover:bg-[#1FC65C] focus:outline-none focus:ring-2 focus:ring-[#25D366]/60"
              >
                See it in action
              </a>
              <a
                href="#features"
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/90 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Explore features
              </a>
            </div>
          </div>

          {/* USSD text block (replaces phone mock) */}
          <div className="space-y-5">
            <h2 className="text-pretty text-3xl font-semibold leading-[1.15] md:text-4xl">
              <span className="bg-gradient-to-r from-[#25D366] to-[#1FC65C] bg-clip-text text-transparent">
                Hedera EVM
              </span>
              <br />
              💬 Living Inside USSD
            </h2>
            <p className="text-pretty text-sm leading-relaxed text-white/70 md:text-base">
              <strong className="text-[#25D366]">Bringing 3 billion Feature phone users to Hedera.</strong>
              <br />
              • Send HBAR • 🍕 Pay bills • 🔒 Manage Wallet — all through simple text messages.
              <br />
              <span className="text-white/90">No apps to download. No wallet Apps to manage. Just pure blockchain in Text SMS.</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#story"
                className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-black hover:bg-[#1FC65C] focus:outline-none focus:ring-2 focus:ring-[#25D366]/60"
              >
                See it in action
              </a>
              <a
                href="#features"
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/90 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Explore features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3D Scroll Story */}
      <section id="story" className="relative">
        <div ref={storyRef} className="h-[300vh]">
          <div className="sticky top-0 h-screen">
            <ChatScene progress={storyProgress} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Feature
            title="💸 Lightning Payments"
            text="Zap HBAR faster than you can say 'HODL'. Send, receive, confirm—all in seconds. Your wallet, your rules, zero friction."
            variant="payments"
          />
          <Feature
            title="🍕 Squad Bill Splitting"
            text="Dinner for 8? Concert tickets? Vacation rental? Auto-split any expense. No awkward 'who owes what' convos ever again."
            variant="groups"
          />
          <Feature
            title="🔒 Fort Knox Escrow"
            text="Lock funds like a boss. Deal goes wrong? Instant refund. Deal goes right? Money flies. Trust the blockchain, not promises."
            variant="escrow"
          />
        </div>
      </section>

      {/* Footer */}
      <footer id="waitlist" className="border-t border-white/10 bg-[#0E1D15]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 sm:flex-row sm:justify-between">
          <p className="text-sm text-white/60">© {new Date().getFullYear()} DeXa Hedera Last Mile Access</p>
        </div>
      </footer>
    </main>
  )
}
