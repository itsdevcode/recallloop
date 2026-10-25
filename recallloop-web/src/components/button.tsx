import type { ComponentProps } from "react";

export function Button({
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 py-2.5 text-sm font-medium tracking-tight text-white transition-all duration-200 hover:bg-forest/90 active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-forest disabled:pointer-events-none disabled:opacity-50 shadow-sm ${className}`}
      {...props}
    />
  );
}
