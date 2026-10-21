// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The setup file of the integration project: it runs in each test worker before the test file.
import { serializePgClientsWithoutSecrets } from './pg-serialization.ts';

serializePgClientsWithoutSecrets();
