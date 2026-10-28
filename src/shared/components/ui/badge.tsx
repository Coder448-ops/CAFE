import { cn } from "@/shared/lib/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "muted";
  className?: string;
}) {
  const tones = {
    neutral: "bg-cream-200 text-coffee-700 ring-coffee-200",
    success: "bg-moss-100 text-moss-700 ring-moss-300/60",
    warning: "bg-amber-100 text-amber-800 ring-amber-300/60",
    danger: "bg-red-50 text-red-700 ring-red-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
    muted: "bg-cream-100 text-coffee-500 ring-coffee-100",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
