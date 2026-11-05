import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./api";

export function createAppQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        retry: (failureCount, error) =>
          failureCount < 1 &&
          !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500),
      },
    },
  });

  client.setQueryDefaults(["ipos"], { staleTime: 2 * 60_000 });
  client.setQueryDefaults(["ipo"], { staleTime: 5 * 60_000 });
  client.setQueryDefaults(["ipo-catalog"], { staleTime: 2 * 60_000 });
  client.setQueryDefaults(["ipo-categories"], { staleTime: 10 * 60_000 });
  client.setQueryDefaults(["ipo-catalog-categories"], { staleTime: 10 * 60_000 });
  client.setQueryDefaults(["applications"], { staleTime: 60_000 });
  client.setQueryDefaults(["analytics"], { staleTime: 30_000 });
  client.setQueryDefaults(["admin"], { staleTime: 60_000 });
  client.setQueryDefaults(["profile"], { staleTime: 5 * 60_000 });
  return client;
}

export const queryClient = createAppQueryClient();
