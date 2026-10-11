// SPDX-License-Identifier: AGPL-3.0-or-later
import { classifyError } from '@northmes/web-sdk';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadWebConfig, ServerUnavailable, type WebConfig } from '../config.ts';
import { BootFailure, type BootFailureKind } from './boot-failure.tsx';

export interface BootWebOptions {
  /** Fetches config.json. */
  readonly fetch: (url: string) => Promise<Response>;
  /** The page's origin, the API's URL when config.json names none. */
  readonly origin: string;
  /** The web, once its config loaded, such as the router's provider. */
  readonly app: (config: WebConfig) => ReactNode;
  /** Reloads the page, for Reload page. */
  readonly reload: () => void;
  /** How long no answer waits before boot tries again: 10 seconds (shell-306, BO6). */
  readonly retryAfterMs?: number;
}

/** No answer: the fetch got no response, or 502, 503 or 504 from the server in front. */
function failureOf(error: unknown): BootFailureKind {
  if (error instanceof ServerUnavailable) return 'no-answer';
  return classifyError(error).page === 'no-connection' ? 'no-answer' : 'error';
}

/**
 * Boots the web into #root, where index.html shows Loading NorthMES (design shell-306, BO1): it
 * reads config.json and renders the app in its place. A failure renders NorthMES could not start
 * in the same layout (BO3 to BO7), never the raw reason, which goes to the console. After no answer, boot tries again every
 * 10 seconds and renders the app once config.json answers.
 */
export async function bootWeb(root: HTMLElement, options: BootWebOptions): Promise<void> {
  const { fetch, origin, app, reload, retryAfterMs = 10_000 } = options;
  const view = createRoot(root);
  let failed: BootFailureKind | undefined;
  const attempt = async (): Promise<void> => {
    try {
      const config = await loadWebConfig(fetch, origin);
      view.render(app(config));
    } catch (error) {
      // The page never shows the reason; the console keeps it for whoever runs the host.
      console.error('NorthMES could not start:', error);
      const kind = failureOf(error);
      // The card renders once per kind, so the polite region says it once.
      if (failed !== kind) view.render(<BootFailure key={kind} kind={kind} onReload={reload} />);
      failed = kind;
      if (kind === 'no-answer') setTimeout(() => void attempt(), retryAfterMs);
    }
  };
  await attempt();
}
