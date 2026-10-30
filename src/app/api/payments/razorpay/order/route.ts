import { HttpError } from "@/lib/db";
import { json, withDb } from "@/lib/server/http";
import { requireUser } from "@/lib/server/canteen";
import { createCheckoutOrder } from "@/lib/server/razorpay";
import type { PaymentKind } from "@/lib/types";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const user = await requireUser(request);
  const body = (await request.json()) as { orderId?: string; kind?: PaymentKind };
  if (body.kind !== "advance" && body.kind !== "balance") {
    throw new HttpError("Choose an advance or balance payment.", 400);
  }
  return json(await createCheckoutOrder(user, body.orderId ?? "", body.kind));
});
