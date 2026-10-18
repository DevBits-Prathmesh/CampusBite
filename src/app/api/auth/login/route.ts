import { loginAccount } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const body = (await request.json()) as { email?: string; password?: string };
  return json(await loginAccount(body.email ?? "", body.password ?? ""));
});
