import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../components/ui/Toast";
import { router } from "./router";
import { queryClient } from "../lib/queryClient";
import { store } from "../store";
import { LoadingState } from "../components/LoadingState";

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

export function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<LoadingState label="Loading page" fullPage />}>
              <RouterProvider router={router} />
            </Suspense>
          </ToastProvider>
        </AuthProvider>
        {ReactQueryDevtools && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </QueryClientProvider>
    </Provider>
  );
}
