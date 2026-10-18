import { loadState, readUser } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";

export const runtime = "nodejs";

export const GET = withDb(async (request) => {
  const user = await readUser(request);
  return json(await loadState(user));
});
