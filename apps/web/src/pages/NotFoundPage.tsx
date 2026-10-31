import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center">
      <div className="max-w-sm space-y-6">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-subtle">
          <span className="text-5xl font-black tabular text-navy/20" aria-hidden="true">
            404
          </span>
        </div>

        {/* Text */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-action">
            Page not found
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            We couldn't find this page
          </h1>
          <p className="mt-2 text-base text-muted">
            The address may be incorrect or the page may have moved.
          </p>
        </div>

        {/* Action */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="default"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => window.history.back()}
          >
            Go back
          </Button>
          <Link to="/">
            <Button variant="outline" size="md" className="w-full sm:w-auto">
              <Home size={16} aria-hidden="true" />
              Return home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
