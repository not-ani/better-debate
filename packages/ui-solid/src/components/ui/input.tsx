import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn";

export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      class={cn(
        "h-8 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 text-xs text-neutral-100 outline-none transition placeholder:text-neutral-500 hover:border-neutral-600 focus:border-blue-500",
        local.class,
      )}
      {...rest}
    />
  );
}
