import { registerAccount } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const body = (await request.json()) as { name?: string; email?: string; password?: string };
  const result = await registerAccount(body.name ?? "", body.email ?? "", body.password ?? "");
  return json(result);
});
