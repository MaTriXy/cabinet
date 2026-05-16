import { NextResponse } from "next/server";
import { providerRegistry } from "@/lib/agents/provider-registry";
import type { ProviderModel } from "@/lib/agents/provider-interface";

interface CachedModels {
  models: ProviderModel[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CachedModels>();

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const provider = providerRegistry.get(id);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${id}` }, { status: 404 });
  }

  // `?refresh=1` bypasses the cache. opencode's own env/auth gating is live
  // (add a key, re-run, the models appear) so the only staleness is *this*
  // 60s cache — refresh lets a freshly-added key surface in seconds.
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";

  const now = Date.now();
  const cached = cache.get(id);
  if (!refresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      providerId: id,
      models: cached.models,
      cached: true,
      ageMs: now - cached.fetchedAt,
    });
  }

  let models: ProviderModel[];
  let dynamic = false;
  if (provider.listModels) {
    try {
      models = await provider.listModels();
      dynamic = true;
    } catch {
      models = provider.models || [];
    }
  } else {
    models = provider.models || [];
  }

  cache.set(id, { models, fetchedAt: now });

  return NextResponse.json({
    providerId: id,
    models,
    cached: false,
    dynamic,
    ttlMs: CACHE_TTL_MS,
  });
}
