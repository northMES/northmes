import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from 'cn';
import type * as React from 'react';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // NorthMES edit: the D1 Input (docs/design/ui/ui-189-tokens.md, Components) with the D1
        // two-tone focus ring from app.css; invalid adds a 1 px inset beside the ring's inner band.
        'h-(--nm-control-height) w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground transition-colors motion-reduce:transition-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-foreground focus-visible:border-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)] aria-invalid:focus-visible:shadow-[0_0_0_2px_var(--focus-ring),inset_0_0_0_1px_var(--destructive)]',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
