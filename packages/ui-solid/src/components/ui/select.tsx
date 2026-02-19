import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn";

export type SelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement>;

export function Select(props: SelectProps) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <select
      class={cn(
        "h-8 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 text-xs text-neutral-200 outline-none transition hover:border-neutral-600 focus:border-blue-500",
        local.class,
      )}
      {...rest}
    />
  );
}
