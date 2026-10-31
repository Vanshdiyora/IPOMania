import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Application rendering failed", { error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
          <section className="max-w-lg rounded-xl border border-border bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-4 text-danger" aria-hidden="true" size={40} />
            <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
            <p className="mt-3 text-base text-muted">
              The page could not be displayed. Try loading it again.
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
