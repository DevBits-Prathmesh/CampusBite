import { logoutAccount } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  await logoutAccount(request);
  return json({ ok: true });
});
