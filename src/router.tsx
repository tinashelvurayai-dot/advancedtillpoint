import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installQueryPersistence } from "./lib/query-persist";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // "always": the till owns its own offline handling (local caches +
        // queue). React Query must never park a request just because the
        // browser reports no connection.
        networkMode: "always",
        staleTime: 60_000,
        gcTime: 24 * 60 * 60_000,
        retry: 0,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Without this, an offline checkout is PAUSED by React Query: the
        // mutation function never runs and the button hangs on
        // "Saving on device...". Sales must always commit locally first.
        networkMode: "always",
        retry: 0,
      },
    },
  });


  // Offline durability: every successful read is mirrored on the device so a
  // weak connection never makes saved records look like they disappeared.
  installQueryPersistence(queryClient);


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
