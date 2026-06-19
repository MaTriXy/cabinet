import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { resolveContentPath } from "@/lib/storage/path-utils";
import { ROOT_CABINET_PATH, normalizeCabinetPath } from "@/lib/cabinets/paths";
import { listRooms } from "@/lib/cabinets/rooms";

/**
 * Per-room knowledge sources (Connect Knowledge / Drive browser).
 *
 * Replaces the global `google_drive_mounts` SQLite table. Each room owns its
 * connected sources in `<room>/.agents/.config/knowledge-sources.json`, so a
 * room's Drive browser shows only what was connected in that room (no global
 * cross-room leak). See docs/CONNECT_KNOWLEDGE_PRD.md §5.
 */

export type KnowledgeProviderId =
  | "local"
  | "google-drive"
  | "icloud"
  | "sharepoint"
  | "dropbox";

export type KnowledgePolicy = "read-only" | "read-write";
export type KnowledgeSurface = "browser" | "inline";

export interface KnowledgeSource {
  id: string;
  provider: KnowledgeProviderId;
  /** Real filesystem path of the connected folder (the provider's local mount). */
  absPath: string;
  /** Display name. */
  name: string;
  policy: KnowledgePolicy;
  /** "browser" → shown in the per-room Drive browser; "inline" → symlinked at treePath. */
  surface: KnowledgeSurface;
  /** For inline sources: where in the room's tree the symlink lives. */
  treePath?: string;
  enabled: boolean;
  addedAt: string;
}

interface SourcesFile {
  version: 1;
  sources: KnowledgeSource[];
}

/** A connected Drive folder in the shape buildGoogleDriveTree() / the guards expect. */
export interface DriveMount {
  id: string;
  abs_path: string;
  folder_name: string;
}

/** `<room>/.agents/.config/knowledge-sources.json`, traversal-guarded. */
function sourcesFilePath(cabinetPath: string): string {
  const normalized = normalizeCabinetPath(cabinetPath, true) || ROOT_CABINET_PATH;
  const rel = normalized === ROOT_CABINET_PATH ? "" : normalized;
  const roomDir = resolveContentPath(rel); // "" → DATA_DIR
  return path.join(roomDir, ".agents", ".config", "knowledge-sources.json");
}

export async function readKnowledgeSources(
  cabinetPath: string,
): Promise<KnowledgeSource[]> {
  try {
    const raw = await fs.readFile(sourcesFilePath(cabinetPath), "utf-8");
    const parsed = JSON.parse(raw) as Partial<SourcesFile>;
    if (!parsed || !Array.isArray(parsed.sources)) return [];
    return parsed.sources.filter(
      (s): s is KnowledgeSource =>
        !!s && typeof s.id === "string" && typeof s.absPath === "string",
    );
  } catch {
    return [];
  }
}

async function writeKnowledgeSources(
  cabinetPath: string,
  sources: KnowledgeSource[],
): Promise<void> {
  const file = sourcesFilePath(cabinetPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: SourcesFile = { version: 1, sources };
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
  await fs.rename(tmp, file);
}

export interface AddSourceInput {
  provider: KnowledgeProviderId;
  absPath: string;
  name: string;
  policy?: KnowledgePolicy;
  surface?: KnowledgeSurface;
  treePath?: string;
}

/** Thrown when a source with the same (provider, absPath, surface, treePath) already exists in the room. */
export class DuplicateSourceError extends Error {
  constructor() {
    super("This folder is already connected in this room");
    this.name = "DuplicateSourceError";
  }
}

export async function addKnowledgeSource(
  cabinetPath: string,
  input: AddSourceInput,
): Promise<KnowledgeSource> {
  const sources = await readKnowledgeSources(cabinetPath);
  const surface = input.surface ?? "browser";
  const dup = sources.find(
    (s) =>
      s.provider === input.provider &&
      s.absPath === input.absPath &&
      s.surface === surface &&
      (s.treePath ?? "") === (input.treePath ?? ""),
  );
  if (dup) throw new DuplicateSourceError();

  const source: KnowledgeSource = {
    id: randomUUID(),
    provider: input.provider,
    absPath: input.absPath,
    name: input.name,
    policy: input.policy ?? "read-only",
    surface,
    treePath: input.treePath,
    enabled: true,
    addedAt: new Date().toISOString(),
  };
  sources.push(source);
  await writeKnowledgeSources(cabinetPath, sources);
  return source;
}

export async function removeKnowledgeSource(
  cabinetPath: string,
  id: string,
): Promise<boolean> {
  const sources = await readKnowledgeSources(cabinetPath);
  const next = sources.filter((s) => s.id !== id);
  if (next.length === sources.length) return false;
  await writeKnowledgeSources(cabinetPath, next);
  return true;
}

/** Enabled google-drive "browser" sources for a room, in buildGoogleDriveTree() shape. */
export async function listDriveMounts(
  cabinetPath: string,
): Promise<DriveMount[]> {
  const sources = await readKnowledgeSources(cabinetPath);
  return sources
    .filter(
      (s) => s.provider === "google-drive" && s.enabled && s.surface === "browser",
    )
    .map((s) => ({ id: s.id, abs_path: s.absPath, folder_name: s.name }));
}

/**
 * Union of enabled google-drive mounts across the home root and every room.
 * Used by the serve/reveal guards when the caller doesn't pass a specific
 * room — the security property ("path is inside a user-connected Drive
 * folder") holds regardless of which room connected it.
 */
export async function listAllDriveMounts(): Promise<DriveMount[]> {
  const rooms = await listRooms();
  const cabinetPaths = [ROOT_CABINET_PATH, ...rooms.map((r) => r.path)];
  const all: DriveMount[] = [];
  const seen = new Set<string>();
  for (const cp of cabinetPaths) {
    for (const m of await listDriveMounts(cp)) {
      if (seen.has(m.abs_path)) continue;
      seen.add(m.abs_path);
      all.push(m);
    }
  }
  return all;
}

/**
 * Resolve the mount set to authorize a serve/reveal request against: the
 * given room's mounts when a cabinet is supplied, else the union across rooms.
 */
export async function resolveAuthorizedMountPaths(
  cabinetPath: string | null,
): Promise<string[]> {
  const mounts =
    cabinetPath != null && cabinetPath.trim() !== ""
      ? await listDriveMounts(cabinetPath)
      : await listAllDriveMounts();
  return mounts.map((m) => m.abs_path);
}
