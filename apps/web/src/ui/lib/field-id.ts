// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The id of the input that edits the form field `name` (a schema path joined with dots), so the
 * error summary can link to it.
 */
export function fieldId(name: string): string {
  return `field-${name}`;
}
