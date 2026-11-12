/** POST /api/chat — assistant d'orientation « Sahbi » (EF-11). */
import { reply, WELCOME } from "@/lib/chatbot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête illisible" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message : "";
  if (!message.trim()) return Response.json(WELCOME);
  return Response.json(reply(message));
}
