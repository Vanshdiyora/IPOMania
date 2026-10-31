import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth";
import { Card } from "../components/ui/Card";

export function AuthPage({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { configurationError } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-center text-lg font-bold text-navy">
          IPO Mania
        </Link>
        <Card>
          <h1 className="text-2xl font-bold text-navy">{title}</h1>
          {configurationError ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-danger">
              {configurationError}
            </p>
          ) : null}
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 border-t border-border pt-5 text-sm text-muted">{footer}</div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-danger">
      {message}
    </p>
  ) : null;
}
