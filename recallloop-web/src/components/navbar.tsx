"use client";

import Link from "next/link";
import { useState } from "react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="brand" aria-label="RecallLoop home">
          <span aria-hidden="true" className="text-xl">↻</span>
          <span className="text-lg font-semibold tracking-tight text-dark">RecallLoop</span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main"
          className="hidden items-center gap-7 text-sm font-medium text-muted md:flex"
        >
          <a
            href="#how-it-works"
            className="transition-colors hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            How It Works
          </a>
          <a
            href="#features"
            className="transition-colors hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Features
          </a>
          <a
            href="https://github.com/itsdevcode/recallloop"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            GitHub ↗
          </a>
          <div className="h-4 w-px bg-black/10" aria-hidden="true" />
          <Link
            href="/login"
            className="transition-colors hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-forest px-4 py-2 text-xs font-semibold tracking-tight text-white transition-all duration-200 hover:bg-forest/90 active:scale-[0.98] shadow-sm"
          >
            Get started <span aria-hidden="true" className="ml-1">↗</span>
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/register"
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-forest px-3.5 py-1.5 text-xs font-semibold tracking-tight text-white shadow-sm"
          >
            Get started
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-muted transition-colors hover:bg-surface hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-controls="mobile-menu"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="border-b border-black/[0.06] bg-white/95 px-6 py-5 backdrop-blur-lg md:hidden"
        >
          <nav aria-label="Mobile Navigation" className="flex flex-col space-y-4 text-base font-medium">
            <a
              href="#how-it-works"
              className="min-h-11 py-2 text-dark"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </a>
            <a
              href="#features"
              className="min-h-11 py-2 text-dark"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="https://github.com/itsdevcode/recallloop"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 py-2 text-muted"
            >
              GitHub ↗
            </a>
            <hr className="border-black/[0.08]" />
            <Link
              href="/login"
              className="min-h-11 py-2 text-dark"
              onClick={() => setMobileMenuOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-forest px-6 py-3 font-semibold text-white shadow-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Start Remembering ↗
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
