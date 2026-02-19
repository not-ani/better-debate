import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "icon" | "icon-sm";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "border-blue-600 bg-blue-600 text-white hover:border-blue-500 hover:bg-blue-500 disabled:opacity-50",
  secondary:
    "border-neutral-700 bg-neutral-800 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-700 hover:text-white disabled:opacity-50",
  outline:
    "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-50",
  ghost: "border-transparent bg-transparent text-neutral-300 hover:bg-neutral-800/80 hover:text-neutral-100 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-8 px-3 text-xs",
  sm: "h-7 px-2.5 text-xs",
  icon: "h-8 w-8 px-0",
  "icon-sm": "h-7 w-7 px-0",
};

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["class", "variant", "size"]);

  return (
    <button
      class={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition disabled:cursor-not-allowed",
        variantClasses[local.variant ?? "secondary"],
        sizeClasses[local.size ?? "default"],
        local.class,
      )}
      {...rest}
    />
  );
}
