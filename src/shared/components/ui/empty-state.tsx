import { cn } from "@/shared/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  icon = "◦",
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-coffee-200 bg-cream-50/60 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-200 text-xl text-coffee-500" aria-hidden>
        {icon}
      </div>
      <div>
        <p className="font-display text-lg font-semibold text-coffee-800">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-sm text-sm text-coffee-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-white px-3 py-1.5 font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
          >
            Qayta urinish
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-cream-200/80", className)} aria-hidden />;
}

export function LoadingBlock({ label = "Yuklanmoqda..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-coffee-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-coffee-200 border-t-moss-600" />
      {label}
    </div>
  );
}
