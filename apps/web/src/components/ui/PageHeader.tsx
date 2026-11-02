import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

// ─── PageHeader ───────────────────────────────────────────────────────────────
interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  subtitle,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const desc = description ?? subtitle;

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-indigo-100 bg-white px-5 py-5 shadow-card sm:px-6",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-action via-indigo-400 to-teal-500"
      />
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-action">{eyebrow}</p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {desc && <p className="mt-1.5 text-base text-muted leading-relaxed">{desc}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────
interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-1", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight size={14} className="text-subtle" aria-hidden="true" />}
            {item.href && index < items.length - 1 ? (
              <Link to={item.href} className="transition-colors duration-150 hover:text-navy">
                {item.label}
              </Link>
            ) : (
              <span
                className={index === items.length - 1 ? "font-medium text-ink" : ""}
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  trend?: { value: string; positive: boolean };
  icon?: ReactNode;
  className?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  detail,
  trend,
  icon,
  className,
  loading = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/90 bg-gradient-to-br from-white to-indigo-50/30 p-5 shadow-card",
        "transition-all duration-200 hover:shadow-card-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-action-light to-teal-50 text-action ring-1 ring-indigo-100">
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 skeleton rounded" />
      ) : (
        <p className="mt-2 text-3xl font-bold tabular tracking-tight text-ink">{value}</p>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        {detail && <p className="text-xs text-muted">{detail}</p>}
        {trend && (
          <span
            className={cn("text-xs font-semibold", trend.positive ? "text-success" : "text-danger")}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── DataRow ──────────────────────────────────────────────────────────────────
export function DataRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border py-3 last:border-0",
        className,
      )}
    >
      <dt className="min-w-0 text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
