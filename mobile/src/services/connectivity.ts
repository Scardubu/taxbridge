let _online = true;

export function isOnline() {
  return _online;
}

// lightweight periodic ping to detect connectivity without extra deps
export function startConnectivityMonitor(pingUrl: string | null = null, interval = 10000) {
  let mounted = true;
  async function check() {
    try {
      if (!pingUrl) {
        // quick DNS-level check
        await fetch('https://clients3.google.com/generate_204', { method: 'GET', cache: 'no-store' });
      } else {
        await fetch(pingUrl, { method: 'HEAD', cache: 'no-store' });
      }
      _online = true;
    } catch {
      _online = false;
    }
  }

  const id = setInterval(() => {
    if (!mounted) return;
    void check();
  }, interval);

  // do an immediate check
  void check();

  return () => {
    mounted = false;
    clearInterval(id);
  };
}

export function stopConnectivityMonitor(cleanup: ReturnType<typeof startConnectivityMonitor> | undefined) {
  if (typeof cleanup === 'function') cleanup();
}
