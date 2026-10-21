// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The setup file of the integration project: it runs in each test worker before the test file.
import { serializePgConnectionsWithoutSecrets } from './pg-serialization.ts';

serializePgConnectionsWithoutSecrets();
