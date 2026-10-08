// SPDX-License-Identifier: MIT
import { notFound } from '@tanstack/react-router';

export function missingOrder(): never {
  throw notFound();
}
