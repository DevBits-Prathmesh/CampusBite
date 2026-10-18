import { requireUser, saveMenuItem } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";
import type { MenuItem } from "@/lib/types";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const user = await requireUser(request);
  const item = (await request.json()) as MenuItem;
  await saveMenuItem(user, item, true);
  return json({ ok: true });
});
