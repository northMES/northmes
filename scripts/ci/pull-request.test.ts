// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { eventPullNumber, pullNumberOfQueueRef } from './pull-request.mjs';

describe('#985 the pull request behind a merge group', () => {
  it('#985 the queue branch names the pull request between pr- and the base commit', () => {
    expect(
      pullNumberOfQueueRef(
        'refs/heads/gh-readonly-queue/main/pr-958-8e4e97c1e0d6a1f0f4c3b2a19d8e7f6a5b4c3d2e',
      ),
    ).toBe(958);
    expect(
      pullNumberOfQueueRef(
        'gh-readonly-queue/main/pr-104-929f8209d40f77f4abc622a499c93a83babdbe64',
      ),
    ).toBe(104);
  });

  it('#985 a ref that is not a queue branch, or an empty one, names no pull request', () => {
    expect(pullNumberOfQueueRef('refs/heads/main')).toBeUndefined();
    expect(pullNumberOfQueueRef('refs/heads/feat/pr-12-things')).toBeUndefined();
    expect(
      pullNumberOfQueueRef('refs/heads/gh-readonly-queue/main/pr-abc-deadbeef'),
    ).toBeUndefined();
    expect(pullNumberOfQueueRef('refs/heads/gh-readonly-queue/main/pr-0-deadbeef')).toBeUndefined();
    expect(pullNumberOfQueueRef('')).toBeUndefined();
    expect(pullNumberOfQueueRef(undefined)).toBeUndefined();
  });
});

describe('#985 the pull request an event is about', () => {
  it('#985 a pull_request event names its own number, and a merge_group event the queue branch', () => {
    expect(eventPullNumber({ number: '958', queueRef: '' })).toBe(958);
    expect(
      eventPullNumber({
        number: '',
        queueRef:
          'refs/heads/gh-readonly-queue/main/pr-964-8e4e97c1e0d6a1f0f4c3b2a19d8e7f6a5b4c3d2e',
      }),
    ).toBe(964);
    expect(eventPullNumber({ number: undefined, queueRef: undefined })).toBeUndefined();
    expect(eventPullNumber({ number: '0', queueRef: 'refs/heads/main' })).toBeUndefined();
    expect(eventPullNumber({ number: 'x', queueRef: '' })).toBeUndefined();
  });
});
