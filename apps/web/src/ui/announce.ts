// SPDX-License-Identifier: AGPL-3.0-or-later

/** The id of the polite live region that index.html holds outside #root. */
export const politeRegionId = 'announcer-polite';

/** The pause between clearing the region and setting a message, and before the next message. */
const step = 150;

const queue: string[] = [];
let speaking = false;

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

function speakNext(): void {
  const message = queue.shift();
  if (message === undefined) {
    speaking = false;
    return;
  }
  speaking = true;
  politeRegion().textContent = '';
  setTimeout(() => {
    politeRegion().textContent = message;
    setTimeout(speakNext, step);
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
