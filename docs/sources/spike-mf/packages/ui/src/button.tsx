import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground ${className}`}
      {...props}
    />
  );
}
