// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailTabs } from '../../../src/ui/components/detail-tabs/index.ts';

afterEach(cleanup);

/** A user's tabs, whose open tab the caller keeps, as a page keeps it in the URL. */
function UserTabs({ onChange }: { readonly onChange: (tab: string) => void }) {
  const [tab, setTab] = useState('general');
  return (
    <DetailTabs
      label="Sara Nyberg"
      value={tab}
      onValueChange={(next) => {
        onChange(next);
        setTab(next);
      }}
      tabs={[
        { value: 'general', label: 'General', content: <p>Username s.nyberg</p> },
        { value: 'access', label: 'Access', content: <p>Shift lead at Plant A</p> },
      ]}
    />
  );
}

describe('DetailTabs', () => {
  it('E04-S07 the tablist is named by the record, the open tab is selected and its panel is labelled by it', () => {
    render(<UserTabs onChange={() => {}} />);

    expect(screen.getByRole('tablist', { name: 'Sara Nyberg' })).toBeDefined();
    const general = screen.getByRole('tab', { name: 'General' });
    expect(general.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'General' }).textContent).toBe('Username s.nyberg');
  });

  it('E04-S07 arrow keys move focus without opening a tab, and Enter opens the focused tab, where focus stays', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<UserTabs onChange={onChange} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'General' }));
    await user.keyboard('{ArrowRight}');
    const access = screen.getByRole('tab', { name: 'Access' });
    expect(document.activeElement).toBe(access);
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('access');
    expect(access.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(access);
    expect(screen.getByRole('tabpanel', { name: 'Access' }).textContent).toBe(
      'Shift lead at Plant A',
    );
  });
});
