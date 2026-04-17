import { NextRequest, NextResponse } from "next/server";
import { continueConversationRun } from "@/lib/agents/conversation-runner";
import { readConversationMeta } from "@/lib/agents/conversation-store";

interface ContinueBody {
  userMessage?: string;
  mentionedPaths?: string[];
  cabinetPath?: string;
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!userMessage) {
    return NextResponse.json(
      { error: "userMessage is required" },
      { status: 400 }
    );
  }

  const cabinetPath =
    typeof body.cabinetPath === "string" && body.cabinetPath.trim()
      ? body.cabinetPath.trim()
      : req.nextUrl.searchParams.get("cabinetPath") || undefined;

  const existing = await readConversationMeta(id, cabinetPath);
  if (!existing) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const mentionedPaths = Array.isArray(body.mentionedPaths)
    ? body.mentionedPaths.filter((v): v is string => typeof v === "string")
    : [];

  // Fire the continuation in the background; the UI streams updates via SSE.
  void continueConversationRun(id, {
    userMessage,
    mentionedPaths,
    cabinetPath: existing.cabinetPath ?? cabinetPath,
  }).catch((err) => {
    console.error(`[conversation-runner] ${id} continue failed`, err);
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
