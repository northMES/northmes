// SPDX-License-Identifier: AGPL-3.0-or-later
import { configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetAnnouncements } from '../src/ui/lib/announce.ts';

// A findBy query waits 1 s by default. A route's lazy screen chunk can take longer than that to
// transform and render when other test runs load the machine, so the tests wait up to 5 s. A test
// that passes waits only as long as the screen takes.
configure({ asyncUtilTimeout: 5000 });

// A test can end with an announcement still queued, as one that ends right after a save does. The
// queue and its timer go with the test, so the next test starts with an empty queue.
afterEach(() => {
  resetAnnouncements();
});
