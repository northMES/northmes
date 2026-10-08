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

/**
 * Starts a process that starts sleep 30 the way pnpm dev starts its processes and hands
 * onStopSignal an async function with body stop, in which sleeper is the started sleep. Resolves
 * once sleep runs, with the lines the process printed so far and later.
 * @param stop
 */
async function startWithStop(stop: string) {
  const processes = new URL('./processes.mjs', import.meta.url).href;
  const script = `
    import { onStopSignal, start } from ${JSON.stringify(processes)};
    const sleeper = start({ name: 'sleep', command: 'sh', args: ['-c', 'echo $$; exec sleep 30'], env: {} });
    onStopSignal(async () => {
      ${stop}
    });
  `;
  const parent = spawn(process.execPath, ['--input-type=module', '-e', script], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const lines: string[] = [];
  const exited = new Promise<number | null>((resolve) => parent.once('exit', resolve));
  const sleeper = await new Promise<number>((resolve, reject) => {
    createInterface({ input: parent.stdout }).on('line', (line) => {
      lines.push(line);
      const pid = /^\[sleep\] (\d+)$/.exec(line)?.[1];
      if (pid) resolve(Number(pid));
    });
    parent.once('exit', (code) => reject(new Error(`The parent exited with ${code}`)));
  });
  cleanUp(sleeper);
  return { parent, lines, exited, sleeper };
}

describe('onStopSignal', () => {
  // Ctrl+C sends SIGINT, a process manager SIGTERM, and a terminal that closes sends SIGHUP. The
  // started processes run in process groups of their own, so none of these signals reaches them.
  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)(
    'E02-S08 %s to pnpm dev or pnpm demo stops the processes it started',
    async (signal) => {
      const dev = await startWithStop(`
        await sleeper.stop();
        process.exit(0);
      `);

      dev.parent.kill(signal);
      await dev.exited;

      expect(running(dev.sleeper)).toBe(false);
    },
  );

  it('E02-S08 a second Ctrl+C while pnpm dev or pnpm demo stops lets the stop finish', async () => {
    const dev = await startWithStop(`
      console.log('stopping');
      await new Promise((resolve) => setTimeout(resolve, 300));
      await sleeper.stop();
      process.exit(0);
    `);

    dev.parent.kill('SIGINT');
    await vi.waitFor(() => expect(dev.lines).toContain('stopping'));
    dev.parent.kill('SIGINT');

    expect(await dev.exited).toBe(0);
    expect(dev.lines.filter((line) => line === 'stopping')).toHaveLength(1);
    expect(running(dev.sleeper)).toBe(false);
  });
});
