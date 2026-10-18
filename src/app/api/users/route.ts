import { createStaffAccount, requireUser } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const user = await requireUser(request);
  const body = (await request.json()) as { name?: string; email?: string; password?: string; role?: Role };
  await createStaffAccount(user, body.name ?? "", body.email ?? "", body.password ?? "", body.role as Role);
  return json({ ok: true });
});
