// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConflictSummary } from '../../../src/ui/components/conflict-summary/index.ts';
import { FormActions } from '../../../src/ui/components/form-actions/index.ts';
import { FormSection } from '../../../src/ui/components/form-section/index.ts';
import { UnsavedChangesGuard } from '../../../src/ui/components/unsaved-changes-guard/index.ts';

afterEach(cleanup);

/** Renders page at /form, beside /other, in a memory router; returns the router. */
function renderAtForm(page: () => ReactNode) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const form = createRoute({ getParentRoute: () => root, path: '/form', component: page });
  const other = createRoute({
    getParentRoute: () => root,
    path: '/other',
    component: () => <h1>Other page</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([form, other]),
    history: createMemoryHistory({ initialEntries: ['/form'] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

/** A role form with one field, the guard while it has changes, and a link away. */
function RoleNameForm({ onSave = async () => {} }: { readonly onSave?: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        await onSave();
        setSaving(false);
      }}
    >
      <FormSection title="Role">
        <label>
          Role name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </FormSection>
      <Link to="/other">Roles</Link>
      <FormActions saveLabel="Save role" saving={saving} cancelHref="/other" dirty={name !== ''} />
      <UnsavedChangesGuard when={name !== '' && !saving} />
    </form>
  );
}

describe('form page patterns', () => {
  it('E04-S07 FormSection is a region named by its h2', async () => {
    renderAtForm(() => <RoleNameForm />);

    const section = await screen.findByRole('region', { name: 'Role' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Role' })).toBeDefined();
  });

  it('E04-S07 the sticky Save bar holds the submit button and Cancel, says when changes are not saved, and shows the save busy', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderAtForm(() => <RoleNameForm onSave={onSave} />);

    const save = await screen.findByRole('button', { name: 'Save role' });
    expect(save.getAttribute('type')).toBe('submit');
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/other');
    expect(screen.queryByText('Changes not saved')).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Role name' }), 'Night planner');
    expect(screen.getByText('Changes not saved')).toBeDefined();
    await user.click(save);

    expect(onSave).toHaveBeenCalledOnce();
    expect(save.getAttribute('aria-busy')).toBe('true');
    finish();
    await waitFor(() => expect(save.getAttribute('aria-busy')).toBeNull());
  });

  it('E04-S07 leaving a form with changes asks first: Stay keeps the page and the typed value, Leave goes on', async () => {
    const user = userEvent.setup();
    const router = renderAtForm(() => <RoleNameForm />);

    await user.type(await screen.findByRole('textbox', { name: 'Role name' }), 'Night planner');
    const link = screen.getByRole('link', { name: 'Roles' });
    await user.click(link);

    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' });
    expect(
      within(dialog).getByText(
        'Your changes on this page are not saved. If you leave, they are lost.',
      ),
    ).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Stay on page' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(router.state.location.pathname).toBe('/form');
    expect((screen.getByRole('textbox', { name: 'Role name' }) as HTMLInputElement).value).toBe(
      'Night planner',
    );

    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Leave page' }));
    expect(await screen.findByRole('heading', { name: 'Other page' })).toBeDefined();
  });

  it('E04-S07 a form without changes leaves without asking', async () => {
    const user = userEvent.setup();
    renderAtForm(() => <RoleNameForm />);

    await user.click(await screen.findByRole('link', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Other page' })).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('E04-S07 the conflict summary takes focus, keeps the entries and reloads the record, busy while it runs', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    const onReload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<ConflictSummary noun="role" errors={[]} onReload={onReload} />);

    const summary = screen.getByRole('group', { name: 'This role changed while you edited it' });
    expect(document.activeElement).toBe(summary);
    expect(
      within(summary).getByText(
        'Someone saved this role after you opened it. Your entries are kept. Reload the role to see the saved values, then make your change again.',
      ),
    ).toBeDefined();
    const reload = within(summary).getByRole('button', { name: 'Reload role' });
    await user.click(reload);

    expect(onReload).toHaveBeenCalledOnce();
    expect(reload.getAttribute('aria-busy')).toBe('true');
    finish();
    await waitFor(() => expect(reload.getAttribute('aria-busy')).toBeNull());
  });
});
