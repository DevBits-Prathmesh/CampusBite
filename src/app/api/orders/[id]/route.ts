import { actOnOrder, requireUser } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = withDb<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const body = (await request.json()) as { action?: string };
  await actOnOrder(user, id, body.action ?? "");
  return json({ ok: true });
});
