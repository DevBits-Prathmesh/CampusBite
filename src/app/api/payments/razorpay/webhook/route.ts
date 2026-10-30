import { ensureSchema, HttpError } from "@/lib/db";
import { json } from "@/lib/server/http";
import { handleRazorpayWebhook } from "@/lib/server/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const rawBody = await request.text();
    return json(await handleRazorpayWebhook(rawBody, signature));
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "The Razorpay webhook could not be processed." }, 500);
  }
}
