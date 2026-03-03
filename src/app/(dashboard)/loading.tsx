export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-40" />
      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-64" />
      <div className="rounded-lg border-2 border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="h-12 bg-neutral-200 dark:bg-neutral-800" />
        <div className="p-4 space-y-3">
          <div className="h-4 bg-neutral-100 dark:bg-neutral-900 rounded w-full" />
          <div className="h-4 bg-neutral-100 dark:bg-neutral-900 rounded w-3/4" />
          <div className="h-4 bg-neutral-100 dark:bg-neutral-900 rounded w-5/6" />
        </div>
      </div>
    </div>
  );
}
