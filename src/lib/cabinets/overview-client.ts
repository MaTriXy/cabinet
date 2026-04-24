import type {
  CabinetOverview,
  CabinetVisibilityMode,
} from "@/types/cabinets";

// Client-side fetcher for /api/cabinets/overview with in-flight dedupe and a
// short TTL cache. Six components (tree-view, home-screen, ai-panel,
// use-board-data, agents-workspace, cabinet-view) all request the same
// cabinet overview — without dedupe, mounting the app fires the endpoint 5+
// times in parallel, and each call walks the full data/ tree on the server.

type CacheEntry = {
  data: CabinetOverview;
  fetchedAt: number;
};

const STALE_MS = 3_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CabinetOverview>>();

function keyFor(path: string, visibility: CabinetVisibilityMode) {
  return `${path}::${visibility}`;
}

export async function fetchCabinetOverviewClient(
  path: string,
  visibility: CabinetVisibilityMode,
  options: { force?: boolean } = {}
): Promise<CabinetOverview> {
  const key = keyFor(path, visibility);
  const now = Date.now();

  if (!options.force) {
    const cached = cache.get(key);
    if (cached && now - cached.fetchedAt < STALE_MS) {
      return cached.data;
    }
    const existing = inflight.get(key);
    if (existing) return existing;
  }

  const params = new URLSearchParams({ path, visibility });
  const promise = (async () => {
    const res = await fetch(`/api/cabinets/overview?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`overview fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as CabinetOverview;
    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  }
}

export function invalidateCabinetOverview(
  path?: string,
  visibility?: CabinetVisibilityMode
) {
  if (!path) {
    cache.clear();
    return;
  }
  if (visibility) {
    cache.delete(keyFor(path, visibility));
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${path}::`)) cache.delete(key);
  }
}
