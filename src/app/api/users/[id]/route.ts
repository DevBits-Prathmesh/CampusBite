import { deleteUserAccount, requireUser, setUserRole } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

export const PATCH = withDb<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const body = (await request.json()) as { role?: Role };
  await setUserRole(user, id, body.role as Role);
  return json({ ok: true });
});

export const DELETE = withDb<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  await deleteUserAccount(user, id);
  return json({ ok: true });
});
