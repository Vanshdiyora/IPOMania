import { Card } from "../components/ui/Card";

export function WelcomePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-action">IPO Mania</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Project foundation</h1>
        <p className="mt-3 max-w-3xl text-lg leading-7 text-muted">
          The application foundation is ready. Product features will be introduced in later phases.
        </p>
      </div>
      <Card>
        <h2 className="text-xl font-bold text-ink">Development environment</h2>
        <p className="mt-2 text-base leading-7 text-muted">
          This workspace provides the frontend shell, shared package structure, and API foundation.
          No IPO workflows or authentication behavior are included in this phase.
        </p>
      </Card>
    </div>
  );
}
