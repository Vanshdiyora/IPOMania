import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { backDestination } from "../../lib/navigation";

export function BackLink({
  fallback,
  allowedPath,
  children = "Back to IPOs",
}: {
  fallback: string;
  allowedPath: RegExp;
  children?: React.ReactNode;
}) {
  const { state } = useLocation();
  const destination = backDestination(state, fallback, allowedPath);
  return (
    <Link
      to={destination}
      className="inline-flex min-h-touch items-center gap-2 rounded-lg px-2 text-sm font-semibold text-action hover:bg-action-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
    >
      <ArrowLeft size={17} aria-hidden="true" />
      {children}
    </Link>
  );
}
