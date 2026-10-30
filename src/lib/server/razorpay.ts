import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError, nid, query, withTransaction } from "@/lib/db";
import type { OrderStatus, PaymentKind, User } from "@/lib/types";

type PaymentStatus = "CREATED" | "PAID" | "FAILED" | "CANCELLED";

type PaymentRow = {
  id: string;
  order_id: string;
  user_id: string;
  kind: PaymentKind;
  amount_paise: number;
  status: PaymentStatus;
  provider_order_id: string;
  provider_payment_id: string | null;
};

type OrderRow = {
  id: string;
  user_id: string;
  status: OrderStatus;
  advance_due_paise: number;
  balance_due_paise: number;
  advance_paid_paise: number;
  balance_paid_paise: number;
};

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: "created" | "attempted" | "paid";
  receipt?: string;
};

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  captured: boolean;
};

type RazorpayErrorBody = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
};

function config() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new HttpError(
      "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env, then restart the server.",
      503,
    );
  }
  return { keyId, keySecret };
}

async function razorpayRequest<T>(path: string, init?: RequestInit) {
  const { keyId, keySecret } = config();
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("Razorpay request failed", error);
    throw new HttpError("Could not reach Razorpay. Check the connection and try again.", 502);
  }
  const body = (await response.json().catch(() => null)) as (T & RazorpayErrorBody) | null;
  if (!response.ok || !body) {
    console.error("Razorpay API error", response.status, body);
    throw new HttpError(
      body?.error?.description ?? "Razorpay could not start this payment. Try again in a moment.",
      502,
    );
  }
  return body as T;
}

function signaturesMatch(expected: string, received: string) {
  if (!received) return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function paymentSignature(providerOrderId: string, providerPaymentId: string, keySecret: string) {
  return createHmac("sha256", keySecret).update(`${providerOrderId}|${providerPaymentId}`).digest("hex");
}

function checkoutOptions(payment: PaymentRow, user: User, keyId: string) {
  return {
    key: keyId,
    amount: payment.amount_paise,
    currency: "INR" as const,
    name: "CampusBite",
    description:
      payment.kind === "advance"
        ? `Advance for order ${payment.order_id}`
        : `Balance for order ${payment.order_id}`,
    order_id: payment.provider_order_id,
    prefill: { name: user.name, email: user.email },
    theme: { color: "#00754a" },
  };
}

const paymentColumns = `id, order_id, user_id, kind, amount_paise, status, provider_order_id, provider_payment_id`;

export async function createCheckoutOrder(user: User, orderId: string, kind: PaymentKind) {
  if (kind !== "advance" && kind !== "balance") throw new HttpError("Choose a payment to make.", 400);
  const { keyId } = config();

  return withTransaction(async (client) => {
    // One lock per order/kind stops a double tap from creating two Razorpay orders.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [`razorpay:${orderId}:${kind}`]);

    const orders = await client.query<OrderRow>(
      `SELECT id, user_id, status, advance_due_paise, balance_due_paise, advance_paid_paise, balance_paid_paise
       FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    const order = orders.rows[0];
    if (!order) throw new HttpError("Order not found.", 404);
    if (order.user_id !== user.id) throw new HttpError("You can only pay for your own order.", 403);

    const amountPaise = kind === "advance" ? order.advance_due_paise : order.balance_due_paise;
    const alreadyPaid = kind === "advance" ? order.advance_paid_paise > 0 : order.balance_paid_paise > 0;
    if (alreadyPaid) throw new HttpError("That payment is already complete.", 409);

    if (kind === "advance" && order.status !== "PENDING_ADVANCE") {
      throw new HttpError("This order is not waiting for an advance.", 409);
    }
    if (kind === "balance" && order.status !== "READY_FOR_PICKUP") {
      throw new HttpError("The balance is due once the kitchen marks the order ready.", 409);
    }
    if (!Number.isInteger(amountPaise) || amountPaise < 100) {
      throw new HttpError("The amount is below Razorpay's minimum of ₹1.", 400);
    }

    const existing = await client.query<PaymentRow>(
      `SELECT ${paymentColumns} FROM payments
       WHERE order_id = $1 AND kind = $2 AND status = 'CREATED'
       ORDER BY created_at DESC LIMIT 1`,
      [orderId, kind],
    );
    if (existing.rows[0]) return checkoutOptions(existing.rows[0], user, keyId);

    const paymentId = nid("pmt");
    const providerOrder = await razorpayRequest<RazorpayOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: paymentId,
        notes: {
          app_order_id: orderId,
          payment_id: paymentId,
          kind,
          user_id: user.id,
        },
      }),
    });
    if (providerOrder.amount !== amountPaise || providerOrder.currency !== "INR") {
      console.error("Razorpay order amount mismatch", providerOrder, amountPaise);
      throw new HttpError("Razorpay returned an unexpected order amount.", 502);
    }

    const payment: PaymentRow = {
      id: paymentId,
      order_id: orderId,
      user_id: user.id,
      kind,
      amount_paise: amountPaise,
      status: "CREATED",
      provider_order_id: providerOrder.id,
      provider_payment_id: null,
    };
    await client.query(
      `INSERT INTO payments (id, order_id, user_id, kind, amount_paise, status, provider_order_id)
       VALUES ($1, $2, $3, $4, $5, 'CREATED', $6)`,
      [payment.id, payment.order_id, payment.user_id, payment.kind, payment.amount_paise, payment.provider_order_id],
    );

    return checkoutOptions(payment, user, keyId);
  });
}

async function finalizePayment(paymentId: string, providerPaymentId: string | null) {
  return withTransaction(async (client) => {
    const payments = await client.query<PaymentRow>(
      `SELECT ${paymentColumns} FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId],
    );
    const payment = payments.rows[0];
    if (!payment) throw new HttpError("Payment not found.", 404);
    if (payment.status === "PAID") return { alreadyPaid: true, needsRefund: false };

    const orders = await client.query<OrderRow>(
      `SELECT id, user_id, status, advance_due_paise, balance_due_paise, advance_paid_paise, balance_paid_paise
       FROM orders WHERE id = $1 FOR UPDATE`,
      [payment.order_id],
    );
    const order = orders.rows[0];
    if (!order) throw new HttpError("Order not found.", 404);

    let needsRefund = false;

    if (payment.kind === "advance") {
      if (order.status === "CANCELLED") {
        needsRefund = true;
      } else if (order.advance_paid_paise <= 0) {
        const nextStatus: OrderStatus = order.status === "PENDING_ADVANCE" ? "CONFIRMED" : order.status;
        await client.query(
          `UPDATE orders SET advance_paid_paise = advance_due_paise, status = $2, updated_at = now() WHERE id = $1`,
          [order.id, nextStatus],
        );
      }
    } else if (order.status === "CANCELLED") {
      needsRefund = true;
    } else {
      if (order.status !== "READY_FOR_PICKUP" && order.status !== "PENDING_BALANCE" && order.status !== "COMPLETED") {
        throw new HttpError("This order is not ready for the balance payment.", 409);
      }
      if (order.balance_paid_paise <= 0) {
        const nextStatus: OrderStatus = order.status === "READY_FOR_PICKUP" ? "PENDING_BALANCE" : order.status;
        await client.query(
          `UPDATE orders SET balance_paid_paise = balance_due_paise, status = $2, updated_at = now() WHERE id = $1`,
          [order.id, nextStatus],
        );
      }
    }

    await client.query(
      `UPDATE payments
       SET status = 'PAID', provider_payment_id = COALESCE($2, provider_payment_id), updated_at = now()
       WHERE id = $1`,
      [payment.id, providerPaymentId],
    );

    return { alreadyPaid: false, needsRefund };
  });
}

export async function verifyCheckoutPayment(
  user: User,
  input: { orderId: string; paymentId: string; signature: string },
) {
  const { keySecret } = config();
  const rows = await query<PaymentRow>(
    `SELECT ${paymentColumns} FROM payments WHERE provider_order_id = $1`,
    [input.orderId],
  );
  const payment = rows[0];
  if (!payment) throw new HttpError("This payment is not attached to an order.", 404);
  if (payment.user_id !== user.id) throw new HttpError("You can only pay for your own order.", 403);

  const expected = paymentSignature(payment.provider_order_id, input.paymentId, keySecret);
  if (!signaturesMatch(expected, input.signature)) {
    throw new HttpError("We could not verify this payment. Nothing has been marked as paid.", 400);
  }

  if (payment.status === "PAID") return { ok: true, alreadyPaid: true };

  const providerPayment = await razorpayRequest<RazorpayPayment>(
    `/payments/${encodeURIComponent(input.paymentId)}`,
  );
  if (providerPayment.order_id !== payment.provider_order_id) {
    throw new HttpError("Razorpay returned a payment for a different order.", 400);
  }
  if (providerPayment.amount !== payment.amount_paise || providerPayment.currency !== "INR") {
    throw new HttpError("The paid amount does not match this order.", 400);
  }
  if (providerPayment.status !== "authorized" && providerPayment.status !== "captured") {
    throw new HttpError(`Razorpay reports this payment as ${providerPayment.status}.`, 409);
  }

  const result = await finalizePayment(payment.id, providerPayment.id);
  if (result.needsRefund) {
    throw new HttpError(
      "The payment was received, but this order was cancelled. Contact the canteen for a refund.",
      409,
    );
  }
  return { ok: true, alreadyPaid: result.alreadyPaid };
}

type WebhookEntity = {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
};

export async function handleRazorpayWebhook(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new HttpError("Razorpay webhooks are not configured.", 503);

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!signaturesMatch(expected, signature)) {
    throw new HttpError("Invalid Razorpay webhook signature.", 400);
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: WebhookEntity }; order?: { entity?: WebhookEntity } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw new HttpError("Invalid Razorpay webhook payload.", 400);
  }

  const paymentEntity = event.payload?.payment?.entity;
  if (event.event === "payment.failed") {
    if (paymentEntity?.order_id) {
      await query(
        `UPDATE payments SET status = 'FAILED', updated_at = now()
         WHERE provider_order_id = $1 AND status = 'CREATED'`,
        [paymentEntity.order_id],
      );
    }
    return { received: true };
  }

  if (
    event.event === "payment.captured" ||
    event.event === "payment.authorized" ||
    event.event === "order.paid"
  ) {
    const providerOrderId = paymentEntity?.order_id ?? event.payload?.order?.entity?.id;
    if (!providerOrderId) return { received: true };
    const rows = await query<{ id: string; amount_paise: number }>(
      `SELECT id, amount_paise FROM payments WHERE provider_order_id = $1`,
      [providerOrderId],
    );
    if (!rows[0]) return { received: true };

    // A signed webhook is trustworthy, but still confirm it is for the amount we
    // asked for. A partial/foreign payment must never unlock an order.
    const receivedAmount = paymentEntity?.amount ?? event.payload?.order?.entity?.amount;
    const receivedCurrency = paymentEntity?.currency ?? event.payload?.order?.entity?.currency;
    if (
      (typeof receivedAmount === "number" && receivedAmount !== rows[0].amount_paise) ||
      (receivedCurrency !== undefined && receivedCurrency !== "INR")
    ) {
      console.error("Razorpay webhook amount mismatch", {
        providerOrderId,
        receivedAmount,
        receivedCurrency,
        expected: rows[0].amount_paise,
      });
      return { received: true };
    }

    await finalizePayment(rows[0].id, paymentEntity?.id ?? null);
  }

  return { received: true };
}
