import { requireUser, saveSlot } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";
import type { PickupSlot } from "@/lib/types";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const user = await requireUser(request);
  const slot = (await request.json()) as PickupSlot;
  await saveSlot(user, slot, true);
  return json({ ok: true });
});
