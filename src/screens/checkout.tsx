"use client";

import { useState } from "react";
import { Button, Card, ErrorNote, Screen } from "@/components/ui";
import { formatInr, splitPayment } from "@/lib/money";
import { navigate } from "@/lib/paths";
import { cartSubtotal, useStore } from "@/lib/store";

export function SlotScreen() {
  const { data, selectSlot } = useStore();
  const [error, setError] = useState("");
  if (data.cart.length === 0) {
    return (
      <Screen title="Pickup slot" backHref="/cart/">
        <p className="text-sm text-muted">Add dishes before choosing a slot.</p>
      </Screen>
    );
  }
  return (
    <Screen title="Pickup slot" eyebrow="When will you collect?" backHref="/cart/">
      {data.slots.length === 0 ? (
        <p className="text-sm leading-6 text-muted">No pickup slots yet. An administrator needs to open the day’s windows.</p>
      ) : null}
      <div className="space-y-3">
        {data.slots.map((slot) => {
          const remaining = slot.capacity - slot.reservedCount;
          const full = !slot.isAvailable || remaining <= 0;
          const selected = data.selectedSlotId === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={full}
              onClick={() => {
                const result = selectSlot(slot.id);
                if (!result.ok) setError(result.error);
                else setError("");
              }}
              className={`w-full rounded-xl bg-white p-4 text-left shadow-[0_0_0.5px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.24)] active:scale-[0.99] disabled:opacity-50 ${selected ? "ring-2 ring-accent" : ""}`}
            >
              <span className="block text-lg font-bold text-green">{slot.windowLabel}</span>
              <span className="mt-1 block text-sm text-muted">
                {full ? "Full" : `${remaining} places left`}
              </span>
            </button>
          );
        })}
      </div>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      <Button
        className="mt-6 w-full"
        disabled={!data.selectedSlotId}
        onClick={() => navigate("/checkout/review/")}
      >
        Review order
      </Button>
    </Screen>
  );
}

export function ReviewScreen() {
  const { data, placeOrder } = useStore();
  const [error, setError] = useState("");
  const subtotal = cartSubtotal(data);
  const split = splitPayment(subtotal);
  const slot = data.slots.find((entry) => entry.id === data.selectedSlotId);

  if (data.cart.length === 0 || !slot) {
    return (
      <Screen title="Review" backHref="/checkout/slot/">
        <p className="text-sm text-muted">Choose dishes and a pickup slot first.</p>
        <Button className="mt-6 w-full" onClick={() => navigate("/cart/")}>
          Back to cart
        </Button>
      </Screen>
    );
  }

  return (
    <Screen
      title="Review"
      backHref="/checkout/slot/"
      footer={
        <Button
          className="w-full"
          onClick={() => {
            void placeOrder().then((result) => {
              if (!result.ok) setError(result.error);
              else navigate(`/checkout/pay/?order=${result.orderId}`);
            });
          }}
        >
          Pay advance {formatInr(split.advanceDuePaise)}
        </Button>
      }
    >
      <div className="space-y-3">
        {data.cart.map((line) => {
          const item = data.menu.find((entry) => entry.id === line.itemId);
          if (!item) return null;
          return (
            <div key={line.itemId} className="flex justify-between text-sm">
              <span>
                {item.name} × {line.quantity}
              </span>
              <span className="font-semibold">{formatInr(item.pricePaise * line.quantity)}</span>
            </div>
          );
        })}
      </div>
      <Card className="mt-4">
        <Row label="Pickup" value={slot.windowLabel} />
        <Row label="Subtotal" value={formatInr(subtotal)} />
        <Row label="Pay now · 20%" value={formatInr(split.advanceDuePaise)} strong />
        <Row label="When ready · 80%" value={formatInr(split.balanceDuePaise)} />
      </Card>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </Screen>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? "text-base font-extrabold text-green" : "text-sm"}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function PayScreen({ orderId }: { orderId: string | null }) {
  const { data, payAdvance } = useStore();
  const order = data.orders.find((entry) => entry.id === orderId);
  const [phase, setPhase] = useState<"idle" | "paying">("idle");
  const [error, setError] = useState("");

  if (!order) {
    return (
      <Screen title="Advance payment" backHref="/orders/">
        <p className="text-sm text-muted">This payment is not attached to an order.</p>
      </Screen>
    );
  }

  const verified = order.status !== "PENDING_ADVANCE";

  return (
    <Screen
      title="Advance payment"
      eyebrow="Razorpay"
      backHref={`/orders/${order.id}/`}
      footer={
        <Button
          className="w-full"
          disabled={phase === "paying" || verified}
          onClick={() => {
            setError("");
            setPhase("paying");
            void payAdvance(order.id).then((result) => {
              setPhase("idle");
              if (!result.ok) {
                setError(result.error);
                return;
              }
              navigate(`/orders/${order.id}/`);
            });
          }}
        >
          {verified
            ? "Advance already paid"
            : phase === "paying"
              ? "Opening Razorpay…"
              : `Pay ${formatInr(order.advanceDuePaise)}`}
        </Button>
      }
    >
      <p className="text-sm leading-6 text-muted">
        Pay securely with Razorpay. The order is confirmed only after the canteen server checks the payment signature.
      </p>
      <Card className="mt-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Order {order.id}</p>
        <p className="mt-2 text-4xl font-extrabold text-green">{formatInr(order.advanceDuePaise)}</p>
        <p className="mt-1 text-sm text-muted">20% of {formatInr(order.subtotalPaise)}</p>
        <p className="mt-4 text-xs font-semibold text-muted">UPI · cards · netbanking · wallets</p>
      </Card>
      {phase === "paying" ? <p className="mt-4 text-sm font-semibold text-green">Waiting for Razorpay…</p> : null}
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </Screen>
  );
}

export function BalanceScreen({ orderId }: { orderId: string }) {
  const { data, payBalance } = useStore();
  const order = data.orders.find((entry) => entry.id === orderId);
  const [phase, setPhase] = useState<"idle" | "paying">("idle");
  const [error, setError] = useState("");

  if (!order) {
    return (
      <Screen title="Balance" backHref="/orders/">
        <p className="text-sm text-muted">Order not found.</p>
      </Screen>
    );
  }

  const ready = order.status === "READY_FOR_PICKUP";
  const paid = order.balancePaidPaise > 0;

  return (
    <Screen
      title="Balance payment"
      eyebrow="Razorpay"
      backHref={`/orders/${order.id}/`}
      footer={
        <Button
          className="w-full"
          disabled={!ready || paid || phase === "paying"}
          onClick={() => {
            setError("");
            setPhase("paying");
            void payBalance(order.id).then((result) => {
              setPhase("idle");
              if (!result.ok) {
                setError(result.error);
                return;
              }
              navigate(`/orders/${order.id}/`);
            });
          }}
        >
          {paid
            ? "Balance already paid"
            : phase === "paying"
              ? "Opening Razorpay…"
              : `Pay ${formatInr(order.balanceDuePaise)}`}
        </Button>
      }
    >
      <Card className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Order {order.id}</p>
        <p className="mt-2 text-4xl font-extrabold text-green">{formatInr(order.balanceDuePaise)}</p>
        <p className="mt-1 text-sm text-muted">Remaining after {formatInr(order.advancePaidPaise)} advance</p>
        <p className="mt-4 text-xs font-semibold text-muted">Pay securely with Razorpay</p>
      </Card>
      {!ready && !paid ? (
        <p className="mt-4 text-sm text-muted">The balance opens when the kitchen marks this order ready.</p>
      ) : null}
      {phase === "paying" ? <p className="mt-4 text-sm font-semibold text-green">Waiting for Razorpay…</p> : null}
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </Screen>
  );
}
