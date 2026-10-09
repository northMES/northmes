import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { cn } from 'cn';
import { CheckIcon } from 'lucide-react';

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // NorthMES edit: the D1 Checkbox (docs/design/ui/ui-189-tokens.md, Components) on --card
        // with a --foreground hover border, and the D1 two-tone focus ring from app.css in place of
        // shadcn's outline-none and ring; invalid adds a 1 px inset beside the ring's inner band.
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-card transition-colors motion-reduce:transition-none hover:border-foreground group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary',
        'aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)] aria-invalid:focus-visible:shadow-[0_0_0_2px_var(--focus-ring),inset_0_0_0_1px_var(--destructive)]',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
