// SPDX-License-Identifier: MIT

/** The message of a text over its limit: the field, the allowed range and the length typed. */
export function tooLong(label: string, max: number) {
  return (issue: { readonly input?: unknown }) =>
    `${label} can be 1 to ${max} characters. It has ${String(issue.input).length}.`;
}

/** The message of an optional reason over its limit. */
export function reasonTooLong(max: number) {
  return (issue: { readonly input?: unknown }) =>
    `A reason can be at most ${max} characters. It has ${String(issue.input).length}.`;
}
