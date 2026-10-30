import { deleteMenuItem, requireUser, saveMenuItem } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";
import type { MenuItem } from "@/lib/types";

export const runtime = "nodejs";

export const PATCH = withDb<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const item = (await request.json()) as MenuItem;
  await saveMenuItem(user, { ...item, id }, false);
  return json({ ok: true });
});

export const DELETE = withDb<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  await deleteMenuItem(user, id);
  return json({ ok: true });
});
