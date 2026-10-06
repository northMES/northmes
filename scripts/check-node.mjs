function major(version) {
  return Number.parseInt(version.trim().replace(/^v/, ''), 10);
}

export function compare(running, pinned) {
  if (major(running) === major(pinned)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message: `Node ${running} is running, but .node-version pins ${pinned}. Switch to Node ${pinned}.`,
  };
}
