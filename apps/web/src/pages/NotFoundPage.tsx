import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-action">404</p>
      <h1 className="mt-2 text-3xl font-bold text-navy">Page not found</h1>
      <p className="mt-3 text-lg text-muted">
        The address may be incorrect or the page may have moved.
      </p>
      <Link
        className="mt-6 inline-flex min-h-touch items-center rounded-lg px-5 font-semibold text-action underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        to="/"
      >
        Return to overview
      </Link>
    </main>
  );
}
