import { HttpError } from "@/lib/db";
import { json, withDb } from "@/lib/server/http";
import { requireUser } from "@/lib/server/canteen";
import { verifyCheckoutPayment } from "@/lib/server/razorpay";

export const runtime = "nodejs";

export const POST = withDb(async (request) => {
  const user = await requireUser(request);
  const body = (await request.json()) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
    throw new HttpError("The payment response is incomplete.", 400);
  }
  return json(
    await verifyCheckoutPayment(user, {
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    }),
  );
});
