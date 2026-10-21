// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/** The color of a group as a 6 px stripe before a name, or a dot beside it (design #688). */
export function GroupColor({
  color,
  shape,
}: {
  readonly color: string | undefined;
  readonly shape: 'stripe' | 'dot';
}) {
  if (color === undefined) return null;
  return (
    <span
      aria-hidden
      className={
        shape === 'stripe'
          ? 'inline-block h-4 w-1.5 shrink-0 rounded-sm align-middle'
          : 'inline-block size-2.5 shrink-0 rounded-full align-middle'
      }
      style={{ background: `var(--${color})` }}
    />
  );
}
