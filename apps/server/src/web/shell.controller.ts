// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ServedWeb } from './served-web.ts';

/** The content security policy of the shell: every resource from the server's origin (ADR 0019). */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Answers the SPA paths with the shell's index.html (ADR 0064). */
@Controller()
export class ShellController {
  constructor(@Inject(ServedWeb) private readonly web: ServedWeb) {}

  @Get('{*path}')
  index(@Res() response: Response): void {
    response.setHeader('Content-Security-Policy', CSP);
    const index = join(this.web.shellDir, 'index.html');
    if (!existsSync(index)) {
      response.status(404).type('text').send('The shell is not built');
      return;
    }
    response.setHeader('Cache-Control', 'no-cache');
    response.type('html').send(readFileSync(index, 'utf8'));
  }
}
