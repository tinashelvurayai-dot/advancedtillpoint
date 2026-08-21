import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installQueryPersistence } from "./lib/query-persist";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 24 * 60 * 60_000,
        retry: 0,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
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
