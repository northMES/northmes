import { spawnSync } from 'node:child_process';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

// What the meta tests that read the Markdown documents share. They keep to tracked files, because
// run agents read only those.

export const root = fileURLToPath(new URL('../../', import.meta.url));

// `git ls-files`, not the file system: a link to a file that is not committed resolves here and
// breaks for everyone else.
export function trackedFiles(): Set<string> {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return new Set(result.stdout.split('\0').filter(Boolean));
}

export interface Line {
  text: string;
  // True for the lines of a fenced code block, fence lines included.
  fenced: boolean;
}

// A fence closes on a line of the same character that is at least as long as the line that
// opened it.
export function markdownLines(markdown: string): Line[] {
  let open: { char: string; length: number } | undefined;
  return markdown.split('\n').map((text) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    const char = marker?.[1]?.charAt(0) ?? '';
    const length = marker?.[1]?.length ?? 0;
    if (!open) {
      // The info string of a backtick fence has no backtick: ```code``` is inline code and opens
      // nothing. Without this rule the rest of the file would count as fenced.
      const opens = marker && !(char === '`' && marker[2]?.includes('`'));
      open = opens ? { char, length } : undefined;
      return { text, fenced: Boolean(opens) };
    }
    if (char === open.char && length >= open.length && marker?.[2]?.trim() === '') {
      open = undefined;
    }
    return { text, fenced: true };
  });
}

// The repository path a link points at, or undefined for an external URL, a link within the page
// or an empty link. A link out of the repository gives a path that starts with `..`.
export function linkedPath(from: string, target: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return undefined;
  }
  const [withoutQuery = ''] = target.split(/[?#]/);
  if (withoutQuery === '') {
    return undefined;
  }
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // Not valid percent-encoding: take the text as written.
  }
  const joined = decoded.startsWith('/')
    ? decoded.slice(1)
    : posix.join(posix.dirname(from), decoded);
  return posix.normalize(joined).replace(/\/+$/, '');
}
