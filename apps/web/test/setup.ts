// SPDX-License-Identifier: AGPL-3.0-or-later
import { configure } from '@testing-library/react';

// A findBy query waits 1 s by default. A route's lazy screen chunk can take longer than that to
// transform and render when other test runs load the machine, so the tests wait up to 5 s. A test
// that passes waits only as long as the screen takes.
configure({ asyncUtilTimeout: 5000 });
