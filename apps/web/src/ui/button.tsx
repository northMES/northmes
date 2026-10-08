// SPDX-License-Identifier: AGPL-3.0-or-later
import { Button as BaseButton } from '@base-ui/react/button';
import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { type ButtonSize, type ButtonVariant, buttonVariants } from './button-variants.ts';
import { cn } from './cn.ts';

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
