// SPDX-License-Identifier: AGPL-3.0-or-later
import { Search, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { IconButton } from './button.tsx';
import { cn } from './cn.ts';
import { inputClassName } from './field.ts';

/** The pause in typing after which the field searches. */
const searchDelay = 300;

/** The longest search text the server accepts (plan 06, Lists). */
const maxSearchLength = 100;

export interface SearchFieldProps {
  /** The accessible name, which the field also shows as its placeholder, such as "Search articles". */
  readonly label: string;
  /** The search in effect, such as the q key of the URL; the field follows it when it changes. */
  readonly value: string;
  /** Called with the trimmed text after a pause in typing, and with "" at once on Escape or Clear search. */
  readonly onSearch: (value: string) => void;
  readonly className?: string;
}

/**
 * The search input of a list toolbar (design ui-222, keyboard model): typing searches after a
 * pause, Escape or Clear search empties it at once, and focus stays in the field throughout.
 */
export function SearchField({ label, value, onSearch, className }: SearchFieldProps) {
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // The last search this field sent, so its echo through value keeps the text typed since.
  const [sent, setSent] = useState(value);
  // Counts searches from outside; each one cancels a search that still waits for the pause.
  const [outsideSearches, setOutsideSearches] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A new search from outside, such as Clear filters, replaces the typed text.
  if (value !== shown) {
    setShown(value);
    if (value !== sent) {
      setSent(value);
      setText(value);
      setOutsideSearches((count) => count + 1);
    }
  }

  useEffect(() => {
    if (outsideSearches > 0) clearTimeout(timer.current);
  }, [outsideSearches]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (next: string) => {
    clearTimeout(timer.current);
    if (next === value) return;
    setSent(next);
    onSearch(next);
  };

  const clear = () => {
    setText('');
    search('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || text === '') return;
    event.preventDefault();
    clear();
  };

  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={label}
        maxLength={maxSearchLength}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(next.trim()), searchDelay);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          inputClassName,
          'pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      {text !== '' && (
        <IconButton
          label="Clear search"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          onClick={() => {
            clear();
            input.current?.focus();
          }}
        >
          <X />
        </IconButton>
      )}
    </div>
  );
}
