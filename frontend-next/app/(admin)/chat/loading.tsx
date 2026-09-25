// The legacy RouteFallback from frontend/src/App.jsx, shown inside the admin
// shell while the /chat segment loads. Deliberately plain: it appears briefly
// on first visit, since the route chunk is cached afterwards.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <span className="size-6 animate-spin rounded-full border-2 border-skin-border border-t-skin-accent" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
