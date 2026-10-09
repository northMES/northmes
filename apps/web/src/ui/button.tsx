// SPDX-License-Identifier: AGPL-3.0-or-later
import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn.ts';

/**
 * The D1 button variants and sizes (docs/design/ui/ui-189-tokens.md, Components). Default is the
 * one main action of a region, outline the rest; ghost and link carry no border.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-colors motion-reduce:transition-none disabled:opacity-50 aria-busy:cursor-progress',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border border-input bg-card text-foreground hover:border-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive:
          'border border-destructive bg-card text-destructive hover:bg-destructive-subtle',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-(--nm-control-height) px-4',
        /** IconButton: 36 px square. */
        icon: 'size-(--nm-control-height)',
        /** The 24 px target of Clear search and a chip's remove button. */
        'icon-sm': 'size-(--nm-target-min) rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export interface ButtonProps
  extends Omit<ComponentProps<typeof BaseButton>, 'className' | 'focusableWhenDisabled'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
  /**
   * The action is running: the button keeps focus and its name, reports aria-busy and
   * aria-disabled, shows a spinner and ignores activation until the action ends (D1 Q8).
   */
  readonly loading?: boolean;
}

/** A button on Base UI's Button in a D1 variant. A disabled button leaves the Tab order. */
export function Button({
  variant,
  size,
  className,
  loading = false,
  disabled = false,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      type={type}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {loading && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
      {children}
    </BaseButton>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'aria-label'> {
  /** The accessible name; the icon alone shows nothing to assistive technology. */
  readonly label: string;
  /** The lucide-react icon. */
  readonly children: ReactNode;
}

/** A button that shows only an icon and takes its accessible name from the required label. */
export function IconButton({ label, size = 'icon', children, ...props }: IconButtonProps) {
  return (
    <Button {...props} size={size} aria-label={label}>
      {children}
    </Button>
  );
}
