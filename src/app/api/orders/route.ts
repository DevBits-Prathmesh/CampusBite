import { placeOrder, requireUser } from "@/lib/server/canteen";
import { json, withDb } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const user = await requireUser(request);
  const body = (await request.json()) as {
    slotId?: string;
    items?: { itemId: string; quantity: number }[];
  };
  return json(await placeOrder(user, body.slotId ?? "", body.items ?? []));
});
