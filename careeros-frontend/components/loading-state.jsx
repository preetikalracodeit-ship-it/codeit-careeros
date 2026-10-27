import { Loader2 } from "lucide-react";
import { cn } from "cn";

function LoadingState({ label, title, description, className }) {
  const message = title || label || "Loading…";
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm">{message}</p>
      {description && <p className="max-w-md text-center text-xs">{description}</p>}
    </div>
  );
}

export { LoadingState };
