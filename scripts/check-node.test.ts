import { describe, expect, it } from 'vitest';
import { compare } from './check-node.mjs';

describe('check-node', () => {
  it('a Node major other than .node-version fails naming both versions', () => {
    const result = compare('v24.1.0', '26');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('v24.1.0');
    expect(result.message).toContain('26');
  });

  it('the same major passes', () => {
    expect(compare('v26.0.0', '26').ok).toBe(true);
    expect(compare('v26.3.1', '26.0.0\n').ok).toBe(true);
  });
});
