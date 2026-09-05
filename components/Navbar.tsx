"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "@/components/Logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/membership", label: "Membership" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Pages that open with a dark emerald band need light text until the
  // glass bar appears on scroll.
  const darkHero =
    pathname === "/register" || /^\/events\/[^/]+$/.test(pathname);
  const onDark = darkHero && !scrolled;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-lg shadow-forest-ink/5" : "bg-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-5 transition-all duration-300 ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        <Link href="/" className="flex items-center gap-3">
          <Logo uid="nav" className="h-12 w-12 shrink-0" />
          <span
            className={`font-heading font-black leading-tight tracking-tight transition-colors ${
              onDark ? "text-ivory" : "text-forest"
            }`}
          >
            <span className="text-xl lg:hidden">BAU</span>
            <span className="hidden text-lg lg:inline">
              Bangladesh Association Utah{" "}
              <span className="text-bengal-red">(BAU)</span>
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? onDark
                      ? "bg-white/15 text-ivory"
                      : "bg-forest text-cream"
                    : onDark
                      ? "text-ivory/85 hover:bg-white/10 hover:text-ivory"
                      : "text-forest-ink/80 hover:bg-forest/10 hover:text-forest"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/register"
            className="ml-3 rounded-full bg-bengal-red px-5 py-2 text-sm font-semibold text-white transition-transform hover:scale-105"
          >
            Register &amp; Pay
          </Link>
        </nav>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
        >
          <span
            className={`h-0.5 w-6 transition-transform ${
              onDark && !open ? "bg-ivory" : "bg-forest-ink"
            } ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`h-0.5 w-6 transition-opacity ${
              onDark && !open ? "bg-ivory" : "bg-forest-ink"
            } ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`h-0.5 w-6 transition-transform ${
              onDark && !open ? "bg-ivory" : "bg-forest-ink"
            } ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="glass overflow-hidden border-t border-sand md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-2.5 font-medium text-forest-ink hover:bg-forest/10"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/register"
                className="mt-2 rounded-full bg-bengal-red px-4 py-2.5 text-center font-semibold text-white"
              >
                Register &amp; Pay
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
