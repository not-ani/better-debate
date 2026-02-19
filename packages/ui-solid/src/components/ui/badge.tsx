import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn";

type BadgeVariant = "default" | "info" | "success" | "warning" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-neutral-700 bg-neutral-800 text-neutral-300",
  info: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  muted: "border-neutral-700 bg-neutral-900 text-neutral-400",
};

export type BadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);

  return (
    <span
      class={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]",
        variantClasses[local.variant ?? "default"],
        local.class,
      )}
      {...rest}
    />
  );
}
