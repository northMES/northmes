// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ErrorSummary } from '../../../src/ui/components/error-summary/index.ts';
import {
  fieldProps,
  type ServerFieldError,
  setServerErrors,
  summaryErrors,
  useZodForm,
} from '../../../src/ui/lib/use-zod-form.ts';
import { Button } from '../../../src/ui/primitives/button.tsx';
import { TextField } from '../../../src/ui/primitives/text-field.tsx';

afterEach(cleanup);

const articleFields = z.object({
  code: z.string().trim().min(1, 'Enter an article number.'),
  name: z.string().min(1, 'Enter a name.'),
});

interface ArticleFormProps {
  readonly save: () => Promise<readonly ServerFieldError[]>;
}

/** A fictional edit form with the summary at the top, as the design draws it (DE11). */
function ArticleForm({ save }: ArticleFormProps) {
  const form = useZodForm(articleFields, { defaultValues: { code: '', name: '' } });
  const errors = summaryErrors(form.formState.errors);
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async () => {
        setServerErrors(form, await save());
      })}
    >
      <ErrorSummary
        heading={`Fix ${errors.length} ${errors.length === 1 ? 'field' : 'fields'} to save the article`}
        errors={errors}
        focusKey={form.formState.submitCount}
      />
      <TextField label="Article number" {...fieldProps(form, 'code')} />
      <TextField label="Name" {...fieldProps(form, 'name')} />
      <Button type="submit">Save article</Button>
    </form>
  );
}

describe('ErrorSummary', () => {
  it('E04-S07 a failed submit moves focus to the error summary, which counts the errors and links each to its field', async () => {
    const user = userEvent.setup();
    render(<ArticleForm save={vi.fn(async () => [])} />);

    expect(screen.queryByRole('group', { name: /Fix/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = screen.getByRole('group', { name: 'Fix 2 fields to save the article' });
    expect(document.activeElement).toBe(summary);
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Enter an article number.', 'Enter a name.']);
  });

  it('E04-S07 following a summary link moves focus to its field', async () => {
    const user = userEvent.setup();
    render(<ArticleForm save={vi.fn(async () => [])} />);
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' }));
  });

  it('E04-S07 a summary link reaches a field rendered with its own id', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ErrorSummary
          heading="Fix 1 field to save the article"
          errors={[{ name: 'code', fieldId: 'article-code', message: 'Enter an article number.' }]}
        />
        <TextField label="Article number" name="code" id="article-code" />
      </>,
    );

    const link = screen.getByRole('link', { name: 'Enter an article number.' });
    await user.click(link);

    expect(link.getAttribute('href')).toBe('#article-code');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Article number' }));
  });

  it('E04-S07 the summary takes focus again on the next failed submit and lists server errors without a field as text', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => [
      {
        path: ['code'],
        message: 'Article number AX-20410 is already in use in Acme AB. Choose another number.',
      },
      { path: ['stockUnit'], message: 'Choose a stock unit.' },
    ]);
    render(<ArticleForm save={save} />);
    await user.type(screen.getByRole('textbox', { name: 'Article number' }), 'AX-20410');
    await user.click(screen.getByRole('button', { name: 'Save article' }));
    await user.click(screen.getByRole('textbox', { name: 'Name' }));
    await user.keyboard('Fläns DN50 rostfri');

    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const summary = screen.getByRole('group', { name: 'Fix 2 fields to save the article' });
    expect(document.activeElement).toBe(summary);
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Article number AX-20410 is already in use in Acme AB. Choose another number.',
      'Choose a stock unit.',
    ]);
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Article number AX-20410 is already in use in Acme AB. Choose another number.']);
  });

  it('E06-S06 a summary without errors shows its text and action, such as a version conflict, and takes focus', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const { rerender } = render(
      <ErrorSummary heading="This article changed while you edited it" errors={[]} />,
    );
    expect(screen.queryByRole('group')).toBeNull();

    rerender(
      <ErrorSummary heading="This article changed while you edited it" errors={[]}>
        <p>Your entries are kept.</p>
        <Button onClick={onReload}>Reload article</Button>
      </ErrorSummary>,
    );

    const summary = screen.getByRole('group', { name: 'This article changed while you edited it' });
    expect(document.activeElement).toBe(summary);
    expect(within(summary).getByText('Your entries are kept.')).toBeDefined();
    expect(within(summary).queryByRole('list')).toBeNull();
    await user.click(within(summary).getByRole('button', { name: 'Reload article' }));
    expect(onReload).toHaveBeenCalledOnce();
  });
});
