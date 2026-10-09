// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../../primitives/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../primitives/tooltip.tsx';

export interface IconButtonProps
  extends Omit<ComponentProps<typeof Button>, 'children' | 'aria-label' | 'size'> {
  /** The accessible name, also shown as the tooltip; the icon alone shows nothing to assistive technology. */
  readonly label: string;
  /** 36 px, or the 24 px target of Clear search and a chip's remove button. */
  readonly size?: 'icon' | 'icon-sm';
  /** The lucide-react icon. */
  readonly children: ReactNode;
}

/**
 * A button that shows only an icon (design ui-222, Tooltip): the required label is its accessible
 * name and the text of its tooltip, which opens at once on keyboard focus and after a delay on
 * hover, and closes on Escape with focus kept on the button. The tooltip adds no description,
 * because the label already names the button.
 */
export function IconButton({ label, size = 'icon', children, ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button {...props} size={size} aria-label={label}>
            {children}
          </Button>
        }
      />
      {/* Base UI's popup has no role; the design gives it the tooltip role (ui-222). */}
      <TooltipContent role="tooltip">{label}</TooltipContent>
    </Tooltip>
  );
}
