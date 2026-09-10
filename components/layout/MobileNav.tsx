"use client";

/**
 * MobileNav — shared mobile navigation drawer used by all three sidebar variants.
 *
 * On mobile (< md):
 *   - A sticky top bar shows the Rise On logo + "Rise On" text (tappable to open drawer)
 *     plus a ☰ / ✕ icon button on the right.
 *   - Tapping either opens a full-height slide-in drawer from the left.
 *   - A dark backdrop closes the drawer when tapped.
 *
 * On desktop (≥ md):
 *   - This entire component renders nothing — the desktop sidebar handles navigation.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  iconAlt: string;
  iconClass?: string;
  badge?: number; // optional red badge (e.g. distress alert count)
}

interface MobileNavProps {
  panelLabel: string; // "Member Panel" | "Admin Panel" | "Counselor Panel"
  sections: NavSection[];
  bottomItems?: React.ReactNode; // ProfileCard + Log Out + Get Help Now
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MobileNav({ panelLabel, sections, bottomItems }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trap scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* ── Mobile top bar (hidden on md+) ─────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#1E293B] text-white shadow-md">
        {/* Logo area — tappable */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 focus:outline-none"
          aria-label="Open navigation menu"
        >
          <Image
            src="/logo/Without Text.png"
            alt="Rise On AI Logo"
            width={32}
            height={32}
            className="rounded-lg object-contain"
          />
          <div className="flex flex-col items-start">
            <span className="text-sm font-poppins font-semibold leading-tight">Rise On</span>
            <span className="text-[10px] text-white/50 font-poppins leading-tight">{panelLabel}</span>
          </div>
        </button>

        {/* Hamburger / close button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors focus:outline-none"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
        >
          {open ? (
            /* X icon */
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          ) : (
            /* Hamburger icon */
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          )}
        </button>
      </header>

      {/* ── Backdrop ───────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-in drawer ────────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        className={`
          fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]
          bg-[#1E293B] text-white
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          md:hidden
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-modal="true"
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src="/logo/Without Text.png"
              alt="Rise On AI Logo"
              width={34}
              height={34}
              className="rounded-lg object-contain"
            />
            <div className="flex flex-col">
              <span className="text-base font-poppins font-semibold leading-tight">Rise On</span>
              <span className="text-[11px] text-white/50 font-poppins leading-tight">{panelLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors focus:outline-none"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="15" y2="15" />
              <line x1="15" y1="3" x2="3" y2="15" />
            </svg>
          </button>
        </div>

        {/* Nav sections — scrollable */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-poppins text-white/40 uppercase tracking-widest mb-2 px-1">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href + "/"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-poppins transition-all ${
                        active
                          ? "bg-[#A8DADC]/20 text-[#A8DADC]"
                          : "text-white/70 hover:text-white hover:bg-white/8"
                      }`}
                    >
                      <Image
                        src={item.icon}
                        alt={item.iconAlt}
                        width={18}
                        height={18}
                        className={`object-contain shrink-0 ${item.iconClass ?? ""}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="bg-[#F4A6A6] text-[#1E293B] text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: profile + logout */}
        {bottomItems && (
          <div className="shrink-0 px-4 py-4 border-t border-white/10 space-y-2">
            {bottomItems}
          </div>
        )}
      </div>
    </>
  );
}
