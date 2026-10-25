import type { ComponentProps } from "react";

export function Button({ className = "", type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-forest/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      {...props}
    />
  );
}
