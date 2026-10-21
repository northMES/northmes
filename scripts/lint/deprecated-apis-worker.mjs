// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The worker thread of scanProjects in deprecated-apis.mjs: it scans one tsconfig.json and posts
// the findings back. A scan that throws ends the worker with the error, which scanProjects rejects
// with.

import { parentPort, workerData } from 'node:worker_threads';
import { scanProject } from './deprecated-apis.mjs';

parentPort?.postMessage(scanProject(workerData.root, workerData.configPath));
