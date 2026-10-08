// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import ms from 'ms';

/**
 * The time limit of the example's release check. Every validator has one (ADR 0037). ms is not
 * host-provided, so the plugin build bundles it.
 */
export const releaseCheckTimeoutMs = ms('2s');

@Module({})
export class ExampleValidatorModule {}

export default ExampleValidatorModule;
