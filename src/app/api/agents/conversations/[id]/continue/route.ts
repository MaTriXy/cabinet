import { NextRequest, NextResponse } from "next/server";
import { defaultAdapterTypeForProvider } from "@/lib/agents/adapters";
import { continueConversationRun } from "@/lib/agents/conversation-runner";
import { readConversationMeta } from "@/lib/agents/conversation-store";

interface ContinueBody {
  userMessage?: string;
  mentionedPaths?: string[];
  cabinetPath?: string;
  providerId?: string;
  adapterType?: string;
  model?: string;
  effort?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: ContinueBody = {};
  try {
    body = (await req.json()) as ContinueBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON", errorKind: "unknown" },
      { status: 400 }
    );
  }

  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!userMessage) {
    return NextResponse.json(
      { ok: false, error: "userMessage is required", errorKind: "unknown" },
      { status: 400 }
    );
  }

  const cabinetPath =
    typeof body.cabinetPath === "string" && body.cabinetPath.trim()
      ? body.cabinetPath.trim()
      : req.nextUrl.searchParams.get("cabinetPath") || undefined;

  const existing = await readConversationMeta(id, cabinetPath);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Conversation not found", errorKind: "unknown" },
      { status: 404 }
    );
  }

  const mentionedPaths = Array.isArray(body.mentionedPaths)
    ? body.mentionedPaths.filter((v): v is string => typeof v === "string")
    : [];

  // Runtime override: users can switch provider/model/effort per turn.
  // When only providerId is given without adapterType, derive the default
  // adapter for that provider. When neither is given, the runner inherits
  // from the conversation's existing meta.
  const providerId =
    typeof body.providerId === "string" && body.providerId.trim()
      ? body.providerId.trim()
      : undefined;
  const adapterType =
    typeof body.adapterType === "string" && body.adapterType.trim()
      ? body.adapterType.trim()
      : providerId
        ? defaultAdapterTypeForProvider(providerId)
        : undefined;
  const model =
    typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined;
  const effort =
    typeof body.effort === "string" && body.effort.trim()
      ? body.effort.trim()
      : undefined;

  // Fire the continuation in the background; the UI streams updates via SSE.
  void continueConversationRun(id, {
    userMessage,
    mentionedPaths,
    cabinetPath: existing.cabinetPath ?? cabinetPath,
    providerId,
    adapterType,
    model,
    effort,
  }).catch((err) => {
    console.error(`[conversation-runner] ${id} continue failed`, err);
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
