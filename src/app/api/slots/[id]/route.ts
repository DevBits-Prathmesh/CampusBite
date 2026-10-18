import { requireUser, saveSlot } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";
import type { PickupSlot } from "@/lib/types";

export const runtime = "nodejs";

export const PATCH = withDb<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const slot = (await request.json()) as PickupSlot;
  await saveSlot(user, { ...slot, id }, false);
  return json({ ok: true });
});
