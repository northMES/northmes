// SPDX-License-Identifier: AGPL-3.0-or-later
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names (clsx: strings, arrays, objects, falsy values dropped) and resolves Tailwind
 * conflicts so the later class wins, as in `cn(base, props.className)`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
