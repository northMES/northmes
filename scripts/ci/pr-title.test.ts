import { describe, expect, it } from 'vitest';
import { checkTitle } from './pr-title.mjs';

describe('ci / pr title', () => {
  it('accepts security(core): ...', () => {
    expect(checkTitle('security(core): end the sessions of a disabled user').ok).toBe(true);
  });
});
