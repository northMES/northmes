import { equal } from '../spike-integration/node_modules/.pnpm/@wry+equality@0.5.7/node_modules/@wry/equality/lib/index.js';
const { Temporal } = await import('temporal-polyfill');
const a = Temporal.Instant.from('2026-10-25T00:30:00Z'), b = Temporal.Instant.from('2026-10-25T00:30:00Z');
console.log('wry equal two equal Instants', equal(a, b), '| same ref', equal(a, a), '| in objects', equal({ t: a }, { t: b }));
