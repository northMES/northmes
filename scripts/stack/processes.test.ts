import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { run, start } from './processes.mjs';

/** Whether a process or process group with this id runs; a negative pid names a group. */
function running(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

/** Ends pid when the test finishes, so a failing test leaves no process behind. */
function cleanUp(pid: number) {
  onTestFinished(() => {
    if (running(pid)) process.kill(pid, 'SIGKILL');
  });
}

describe('start', () => {
  it('E02-S08 stopping a started process ends the processes it started too', async () => {
    // A dev server or tsc -b --watch starts children of its own, which outlive their parent unless
    // pnpm dev ends the whole process group.
    let printed: (pids: number[]) => void = () => {};
    const pids = new Promise<number[]>((resolve) => {
      printed = resolve;
    });
    const started = start(
      {
        name: 'parent',
        command: 'node',
        args: [
          '-e',
          "const child = require('node:child_process').spawn('sleep', ['30'], { stdio: 'ignore' }); console.log(process.pid, child.pid); setInterval(() => {}, 1e3);",
        ],
        env: {},
      },
      { onLine: (line) => printed(line.split(' ').map(Number)) },
    );
    const [parent = 0, child = 0] = await pids;
    cleanUp(child);

    await started.stop();

    expect(running(-parent)).toBe(false);
    // The child is gone once its new parent has reaped it.
    await vi.waitFor(() => expect(running(child)).toBe(false));
  });
});

describe('run', () => {
  it('E02-S08 run rejects with the command and the code it exited with', async () => {
    await expect(
      run({ name: 'exit', command: 'node', args: ['-e', 'process.exit(3)'], env: {} }),
    ).rejects.toThrow('node -e process.exit(3) exited with 3');
  });
});

describe('onStopSignal', () => {
  // Ctrl+C sends SIGINT, a process manager SIGTERM, and a terminal that closes sends SIGHUP. The
  // started processes run in process groups of their own, so none of these signals reaches them.
  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)(
    'E02-S08 %s to pnpm dev or pnpm demo stops the processes it started',
    async (signal) => {
      const script = `
        import { onStopSignal, start } from ${JSON.stringify(new URL('./processes.mjs', import.meta.url).href)};
        const sleeper = start({ name: 'sleep', command: 'sh', args: ['-c', 'echo $$; exec sleep 30'], env: {} });
        onStopSignal(async () => {
          await sleeper.stop();
          process.exit(0);
        });
      `;
      const parent = spawn(process.execPath, ['--input-type=module', '-e', script], {
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      const exited = new Promise((resolve) => parent.once('exit', resolve));
      const sleeper = await new Promise<number>((resolve, reject) => {
        createInterface({ input: parent.stdout }).on('line', (line) => {
          const pid = /^\[sleep\] (\d+)$/.exec(line)?.[1];
          if (pid) resolve(Number(pid));
        });
        parent.once('exit', (code) => reject(new Error(`The parent exited with ${code}`)));
      });
      cleanUp(sleeper);

      parent.kill(signal);
      await exited;

      expect(running(sleeper)).toBe(false);
    },
  );
});
