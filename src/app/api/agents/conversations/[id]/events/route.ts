import { NextRequest } from "next/server";
import { conversationEvents } from "@/lib/agents/conversation-events";
import type { ConversationEvent } from "@/lib/agents/conversation-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ConversationEvent | { type: "ping"; ts: string }) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller may be closed
        }
      };

      send({ type: "ping", ts: new Date().toISOString() });

      const unsubscribe = conversationEvents.subscribe(id, (event) => send(event));
      const heartbeat = setInterval(
        () => send({ type: "ping", ts: new Date().toISOString() }),
        15_000
      );

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
