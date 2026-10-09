// SPDX-License-Identifier: AGPL-3.0-or-later
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * The D1 button variants and sizes (docs/design/ui/ui-189-tokens.md, Components). Default is the
 * one main action of a region, outline the rest; ghost and link carry no border.
 */
export const buttonVariants = cva(
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
