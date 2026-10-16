// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/** The id of the polite live region that index.html holds outside #root. */
export const politeRegionId = 'announcer-polite';

/** The pause between clearing the region and setting a message, and before the next message. */
const step = 150;

const queue: string[] = [];
let speaking = false;
/** The timer of the step in progress, so a reset can clear it. */
let pending: ReturnType<typeof setTimeout> | undefined;

/** The polite live region; created at the end of body when the page has none, as in tests. */
function politeRegion(): HTMLElement {
  const existing = document.getElementById(politeRegionId);
  if (existing !== null) return existing;
  const region = document.createElement('div');
  region.id = politeRegionId;
  region.className = 'sr-only';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
  return region;
}

/**
 * Whether the page is gone, as when a test's window closes while a message is still queued. The
 * queue then empties and stops, so the next message on a page starts it again.
 */
function pageGone(): boolean {
  if (typeof document !== 'undefined') return false;
  resetAnnouncements();
  return true;
}

function speakNext(): void {
  if (pageGone()) return;
  const message = queue.shift();
  if (message === undefined) {
    speaking = false;
    return;
  }
  speaking = true;
  politeRegion().textContent = '';
  pending = setTimeout(() => {
    if (pageGone()) return;
    politeRegion().textContent = message;
    pending = setTimeout(speakNext, step);
  }, step);
}

/**
 * Says a status message once through the polite live region (ADR 0021, WCAG 4.1.3). Messages go
 * through a queue that clears the region and then sets the text, so a repeated message is read
 * again and two calls in one tick arrive in order. Toasts never carry the only copy of a message.
 */
export function announce(message: string): void {
  queue.push(message);
  if (!speaking) speakNext();
}

/**
 * Drops the queued messages and the timer of the step in progress, so the next message starts the
 * queue again. The web test setup calls it after each test, so a message one test leaves queued
 * neither speaks into the next test nor fires after the test file has ended.
 */
export function resetAnnouncements(): void {
  clearTimeout(pending);
  pending = undefined;
  queue.length = 0;
  speaking = false;
}
