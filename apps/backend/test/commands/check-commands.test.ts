// SPDX-License-Identifier: AGPL-3.0-or-later
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { BootError } from '../../src/boot/boot-error.ts';
import { checkCommandPermissions } from '../../src/commands/check-commands.ts';
import { dispatch } from '../fixtures/commands/dispatch.ts';
import { stock } from '../fixtures/commands/unguarded-commands.ts';

describe('checkCommandPermissions', () => {
  it('E05-S06 a module whose commands check permissions it declares passes', () => {
    expect(() => checkCommandPermissions([dispatch])).not.toThrow();
  });

  it('E05-S06 a command whose contract names no permission, or one its module does not declare, stops boot naming the command', () => {
    const check = () => checkCommandPermissions([dispatch, stock]);

    expect(check).toThrow(BootError);
    expect(check).toThrow(
      expect.objectContaining({
        problems: [
          'Command stock.countBin of module stock names no permission. Its contract needs permission, such as stock.<entity>:<action>, which the command bus checks at the scope of the row the command changes (ADR 0012)',
          'Command stock.moveBin of module stock checks permission stock.bin:move, which module stock does not declare',
        ],
      }),
    );
  });
});
