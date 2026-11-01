import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth";
import { TrendingUp } from "lucide-react";

export function AuthPage({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { configurationError } = useAuth();

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Left decorative panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy p-10 lg:flex">
        {/* Background pattern */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-action/10" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-action/8" />
          <div className="absolute left-1/3 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-white/4" />
          {/* Grid lines */}
          <svg
            className="absolute inset-0 h-full w-full opacity-5"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-3 w-fit">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-action text-white font-bold">
            IM
          </div>
          <span className="text-lg font-bold text-white">IPO Mania</span>
        </Link>

        {/* Testimonial / Brand copy */}
        <div className="relative space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-action/20">
            <TrendingUp className="text-white" size={24} />
          </div>
          <blockquote className="space-y-3">
            <p className="text-2xl font-semibold leading-snug text-white">
              Your complete IPO intelligence platform.
            </p>
            <p className="text-base text-white/60 leading-relaxed">
              Track applications, demat accounts, allotments, and capital activity — all in one
              private, secure dashboard.
            </p>
          </blockquote>

          {/* Feature highlights */}
          <ul className="space-y-3 pt-2">
            {[
              "Private demat account management",
              "IPO application tracking",
              "Capital & refund analytics",
              "Allotment performance insights",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-white/70">
                <div className="h-1.5 w-1.5 rounded-full bg-action flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/30">
          © {new Date().getFullYear()} IPO Mania. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile logo */}
        <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-action text-white font-bold text-sm">
            IM
          </div>
          <span className="text-base font-bold text-ink">IPO Mania</span>
        </Link>

        <div className="w-full max-w-sm">
          {/* Form header */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          </div>

          {/* Configuration error */}
          {configurationError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
            >
              {configurationError}
            </div>
          )}

          {/* Form content */}
          {children}

          {/* Footer */}
          {footer && (
            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-1 text-xs font-medium text-danger">
      {message}
    </p>
  ) : null;
}
