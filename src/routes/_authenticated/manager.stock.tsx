import { createFileRoute, redirect } from "@tanstack/react-router";

// The Stock page has been merged into the Stock-In Record page.
export const Route = createFileRoute("/_authenticated/manager/stock")({
  beforeLoad: () => {
    throw redirect({ to: "/manager/stock-in" });
  },
});
