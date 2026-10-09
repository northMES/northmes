import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { LoaderCircle } from 'lucide-react';

// NorthMES edit: the D1 variants and sizes (docs/design/ui/ui-189-tokens.md, Components), the D1
// two-tone focus ring from app.css instead of shadcn's ring, and the loading state (D1 Q8).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover',
        outline:
          'border-input bg-card text-foreground hover:border-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary/80',
        ghost:
          'text-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        destructive: 'border-destructive bg-card text-destructive hover:bg-destructive-subtle',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-(--nm-control-height) gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        /** IconButton: 36 px square. */
        icon: 'size-(--nm-control-height)',
        /** The 24 px target of Clear search and a chip's remove button. */
        'icon-sm': 'size-(--nm-target-min) rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled = false,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * The action is running: the button keeps focus and its name, reports aria-busy and
     * aria-disabled, shows a spinner and ignores activation until the action ends (D1 Q8).
     */
    loading?: boolean;
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      aria-busy={loading || undefined}
    >
      {loading && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
