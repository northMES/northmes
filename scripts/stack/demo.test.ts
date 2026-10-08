import { describe, expect, it } from 'vitest';
import { demoPlan } from './demo.mjs';

describe('demoPlan', () => {
  it('E02-S08 pnpm demo without PORT serves on the port the stack took', async () => {
    // A person runs pnpm demo by hand, with no PORT or an empty one.
    for (const env of [{}, { PORT: '' }]) {
      const plan = await demoPlan({ PORT: '50001' }, env);

      expect(plan.server.env).toMatchObject({
        PORT: '50001',
        NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:50001',
      });
      expect(new URL(plan.boardUrl).origin).toBe('http://127.0.0.1:50001');
    }
  });
});
