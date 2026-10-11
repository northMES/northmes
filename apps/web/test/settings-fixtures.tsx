// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule } from '@northmes/web-sdk';
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import type { ShellModule } from '../src/modules.ts';
import { createShellRouter } from '../src/shell/index.ts';
import { PageFrame } from '../src/ui/components/page-frame/index.ts';
import { fakeSession } from './auth/fake-session.ts';

// Fictional data of the settings tests: Acme AB with Plant A and Plant B.

export const companyId = '019a0000-0000-7000-8000-0000000ac3e0';

/** The answer of each operation, by operation name, from the variables it was sent with. */
export type Answers = Readonly<Record<string, (variables: Record<string, unknown>) => unknown>>;

/** A request the fake API saw: its operation, variables and x-northmes-plant. */
export interface SeenRequest {
  readonly operationName: string;
  readonly variables: Record<string, unknown>;
  readonly plant: string | null;
}

/**
 * A fetch that answers each operation that `answers` names with its data, and leaves every other
 * operation open, so a screen stays in its loading state. It records what it saw.
 */
export function fakeApi(answers: Answers) {
  const seen: SeenRequest[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    const { operationName, variables = {} } = JSON.parse(String(init?.body)) as {
      operationName: string;
      variables?: Record<string, unknown>;
    };
    seen.push({
      operationName,
      variables,
      plant: new Headers(init?.headers).get('x-northmes-plant'),
    });
    const answer = answers[operationName];
    if (answer === undefined) return new Promise<Response>(() => {});
    const result = answer(variables);
    if (result === unreachable) throw new TypeError('Failed to fetch');
    const body =
      result instanceof Refusal ? { data: null, errors: [result.error] } : { data: result };
    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/graphql-response+json' },
    });
  });
  return { fetch, seen };
}

/** An answer the API refuses with a GraphQL error. */
class Refusal {
  constructor(
    readonly error: {
      readonly message: string;
      readonly extensions: Record<string, unknown>;
    },
  ) {}
}

/** The API's refusal of a read the user may not make: FORBIDDEN with core.forbidden. */
export function forbidden(): Refusal {
  return new Refusal({
    message: 'Forbidden',
    extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
  });
}

/** An answer that never arrives: the fetch fails, as when the browser cannot reach the API. */
export const unreachable = Symbol('unreachable');

/** coreCompanies: Acme AB with Plant A and Plant B. */
export function companies() {
  return {
    coreCompanies: [
      {
        __typename: 'Company',
        id: companyId,
        name: 'Acme AB',
        plants: [
          {
            __typename: 'Plant',
            id: '019a0000-0000-7000-8000-00000000a1a0',
            slug: 'plant-a',
            name: 'Plant A',
          },
          {
            __typename: 'Plant',
            id: '019a0000-0000-7000-8000-00000000a1b0',
            slug: 'plant-b',
            name: 'Plant B',
          },
        ],
      },
    ],
  };
}

/** coreViewer with these permissions at the plant and at the company. */
export function viewer(plantPermissions: readonly string[], companyPermissions: readonly string[]) {
  return {
    coreViewer: {
      __typename: 'Viewer',
      userId: '019a0000-0000-7000-8000-00000000a1e0',
      plantPermissions,
      companyPermissions,
    },
  };
}

/** A page of a fixture module: its h1 and its title in the page frame. */
function page(title: string) {
  return () => (
    <PageFrame title={title}>
      <button type="button">First control of {title}</button>
    </PageFrame>
  );
}

/**
 * A module with Tools in the main sidebar and Machines and Calendars in the plant settings
 * navigation, as core's machines and calendars registers will sit (ADR 0066).
 */
export const equipment: ShellModule = {
  label: 'Equipment',
  order: 15,
  links: [
    {
      label: 'Tools',
      icon: 'Hammer',
      link: ({ plant }) => ({ href: `/${plant}/equipment/tools` }),
    },
    {
      label: 'Machines',
      icon: 'Drill',
      area: 'settings',
      link: ({ plant }) => ({ href: `/${plant}/equipment/machines` }),
    },
    {
      label: 'Calendars',
      icon: 'CalendarDays',
      area: 'settings',
      permission: 'equipment.calendar:read',
      link: ({ plant }) => ({ href: `/${plant}/equipment/calendars` }),
    },
  ],
  module: defineWebModule({
    id: 'equipment',
    version: '0.4.0',
    routes: (plantRoute) => {
      const equipmentRoute = createRoute({ getParentRoute: () => plantRoute, path: 'equipment' });
      return equipmentRoute.addChildren(
        ['Tools', 'Machines', 'Calendars'].map((title) =>
          createRoute({
            getParentRoute: () => equipmentRoute,
            path: title.toLowerCase(),
            component: page(title),
          }),
        ),
      );
    },
  }),
};

/**
 * A module with one plant settings entry and one company settings entry, so that two of them
 * show how the settings navigations group the entries of the modules other than core.
 */
export function settingsModule(id: string, label: string, order: number): ShellModule {
  return {
    label,
    order,
    links: [
      {
        label: `${label} plans`,
        icon: 'ClipboardList',
        area: 'settings',
        link: ({ plant }) => ({ href: `/${plant}/${id}/plans` }),
      },
    ],
    settingsLinks: [
      {
        label: `${label} rules`,
        icon: 'ListChecks',
        link: ({ companyId: company }) => ({ href: `/settings/${company}/${id}/rules` }),
      },
    ],
    module: defineWebModule({
      id,
      version: '0.1.0',
      routes: (plantRoute) => {
        const moduleRoute = createRoute({ getParentRoute: () => plantRoute, path: id });
        return moduleRoute.addChildren([
          createRoute({
            getParentRoute: () => moduleRoute,
            path: 'plans',
            component: page(`${label} plans`),
          }),
        ]);
      },
    }),
  };
}

/** Renders the shell's router for the modules at path, for a signed-in viewer. */
export function renderShellAt(
  path: string,
  modules: Parameters<typeof createShellRouter>[0],
  options: Partial<Parameters<typeof createShellRouter>[1]> = {},
) {
  const router = createShellRouter(modules, {
    session: fakeSession(),
    ...options,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

/** The text of each crumb of the breadcrumb in the top bar. */
export function crumbs(): (string | null)[] {
  const breadcrumb = within(screen.getByRole('banner')).getByRole('navigation', {
    name: 'Breadcrumb',
  });
  return within(breadcrumb)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

/** The text and href of each link in an element. */
export function linksIn(element: HTMLElement): (string | null)[][] {
  return within(element)
    .queryAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);
}

/** The accessible name of the focused element: its aria-label, else its text. */
export function focusedName(): string {
  const element = document.activeElement;
  return element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? '';
}

/** Resizes happy-dom's window, as the browser does at 320 px or on a desktop. */
export function setViewport(width: number, height: number) {
  (
    window as unknown as {
      happyDOM: { setViewport(viewport: { width: number; height: number }): void };
    }
  ).happyDOM.setViewport({ width, height });
}

/** Whether element a comes before element b in the document. */
export function isBefore(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}
