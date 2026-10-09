// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  fieldProps,
  type ServerFieldError,
  setServerErrors,
  useZodForm,
} from '../../../src/ui/lib/use-zod-form.ts';
import { Button } from '../../../src/ui/primitives/button.tsx';
import { TextField } from '../../../src/ui/primitives/text-field.tsx';

afterEach(cleanup);

// A fictional article form: the code is trimmed and 1 to 32 characters, each operation has a
// cycle time, and the name is required.
const articleFields = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter an article number.')
    .max(32, 'Article number can be 1 to 32 characters.'),
  name: z.string().min(1, 'Enter a name.'),
  operations: z.array(z.object({ cycleTime: z.string() })),
});

interface ArticleFormProps {
  /** What the save sends; it resolves to the server's fieldErrors, if any. */
  readonly save: (values: z.output<typeof articleFields>) => Promise<readonly ServerFieldError[]>;
}

function ArticleForm({ save }: ArticleFormProps) {
  const form = useZodForm(articleFields, {
    defaultValues: { code: '', name: '', operations: [{ cycleTime: '' }, { cycleTime: '' }] },
  });
  const server = form.formState.errors.root?.server;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setServerErrors(form, await save(values));
      })}
    >
      {server?.message && (
        <ul aria-label="Not placed on a field">
          {server.message.split('\n').map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <TextField label="Article number" {...fieldProps(form, 'code')} />
      <TextField label="Name" {...fieldProps(form, 'name')} />
      <TextField
        label="Cycle time of operation 20"
        {...fieldProps(form, 'operations.1.cycleTime')}
      />
      <Button type="submit">Save article</Button>
    </form>
  );
}

describe('useZodForm', () => {
  it('E04-S07 a submit with invalid values shows each Zod message on its field and saves nothing', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => []);
    render(<ArticleForm save={save} />);

    await user.type(
      screen.getByRole('textbox', { name: 'Article number' }),
      'AX-20410-FLANS-DN50-ROSTFRI-REV-C1',
    );
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(
      screen.getByRole('textbox', { name: 'Article number' }).getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      screen.getByRole('textbox', {
        name: 'Article number',
        description: 'Article number can be 1 to 32 characters.',
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('textbox', { name: 'Name', description: 'Enter a name.' }),
    ).toBeDefined();
    expect(save).not.toHaveBeenCalled();
    // The error summary takes focus, so the form does not move it to the first field.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save article' }));
  });

  it('E04-S07 a submit with valid values saves the values the schema outputs', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => []);
    render(<ArticleForm save={save} />);

    await user.type(screen.getByRole('textbox', { name: 'Article number' }), '  AX-20410 ');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Fläns DN50 rostfri');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(save).toHaveBeenCalledWith({
      code: 'AX-20410',
      name: 'Fläns DN50 rostfri',
      operations: [{ cycleTime: '' }, { cycleTime: '' }],
    });
  });

  it('E04-S07 server fieldErrors land on the field named by the path joined with dots, the rest go to root.server, and the typed values stay', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => [
      {
        path: ['code'],
        message: 'Article number AX-20410 is already in use in Acme AB. Choose another number.',
        code: 'core.code_taken',
      },
      { path: ['operations', 1, 'cycleTime'], message: 'Cycle time can be at most 3 600 pcs/h.' },
      { path: ['stockUnit'], message: 'Choose a stock unit.' },
      { path: [], message: 'Unexpected error.' },
    ]);
    render(<ArticleForm save={save} />);

    await user.type(screen.getByRole('textbox', { name: 'Article number' }), 'AX-20410');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Fläns DN50 rostfri');
    await user.type(screen.getByRole('textbox', { name: 'Cycle time of operation 20' }), '4000');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    const code = screen.getByRole('textbox', {
      name: 'Article number',
      description: 'Article number AX-20410 is already in use in Acme AB. Choose another number.',
    }) as HTMLInputElement;
    const cycleTime = screen.getByRole('textbox', {
      name: 'Cycle time of operation 20',
      description: 'Cycle time can be at most 3 600 pcs/h.',
    }) as HTMLInputElement;
    expect(code.getAttribute('aria-invalid')).toBe('true');
    expect(cycleTime.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Choose a stock unit.',
      'Unexpected error.',
    ]);
    expect([code.value, cycleTime.value]).toEqual(['AX-20410', '4000']);
    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe(
      'Fläns DN50 rostfri',
    );
  });
});
