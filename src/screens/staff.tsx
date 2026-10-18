"use client";

import { useState } from "react";
import { Button, Card, Empty, ErrorNote, Screen, StatusBadge } from "@/components/ui";
import { formatInr } from "@/lib/money";
import { navigate } from "@/lib/paths";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

export function KitchenScreen() {
  const { data } = useStore();
  const orders = data.orders.filter((order) => order.status === "CONFIRMED" || order.status === "PREPARING");
  return (
    <Screen title="Kitchen" eyebrow="Orders to prepare" headerRight={<StaffProfile />}>
      {orders.length === 0 ? (
        <Empty title="Queue is clear" body="Confirmed orders show up here after the advance is verified." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} href={`/kitchen/${order.id}/`} />
          ))}
        </div>
      )}
    </Screen>
  );
}

export function KitchenOrderScreen({ orderId }: { orderId: string }) {
  const { data, markPreparing, markReady } = useStore();
  const order = data.orders.find((entry) => entry.id === orderId);
  const [error, setError] = useState("");
  if (!order) {
    return (
      <Screen title="Order" backHref="/kitchen/">
        <Empty title="Not in the queue" body="This order is not waiting on the kitchen." />
      </Screen>
    );
  }
  return (
    <Screen
      title={order.id}
      eyebrow={order.studentName}
      backHref="/kitchen/"
      footer={
        order.status === "CONFIRMED" ? (
          <Button className="w-full" onClick={() => void fail(markPreparing(order.id), setError)}>
            Start preparing
          </Button>
        ) : order.status === "PREPARING" ? (
          <Button className="w-full" onClick={() => void fail(markReady(order.id), setError)}>
            Mark ready
          </Button>
        ) : (
          <Button className="w-full" variant="outline" onClick={() => navigate("/kitchen/")}>
            Back to queue
          </Button>
        )
      }
    >
      <StatusBadge status={order.status} />
      <p className="mt-3 text-sm font-semibold">Pickup {order.slotLabel}</p>
      <Card className="mt-4">
        {order.items.map((item) => (
          <p key={item.menuItemId} className="py-1 text-base font-semibold">
            {item.quantity} × {item.nameSnapshot}
          </p>
        ))}
      </Card>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </Screen>
  );
}

export function PickupScreen() {
  const { data } = useStore();
  const orders = data.orders.filter(
    (order) => order.status === "READY_FOR_PICKUP" || order.status === "PENDING_BALANCE",
  );
  return (
    <Screen title="Pickup" eyebrow="Counter" headerRight={<StaffProfile />}>
      {orders.length === 0 ? (
        <Empty title="No collections" body="Ready orders appear here for the counter." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} href={`/pickup/${order.id}/`} />
          ))}
        </div>
      )}
    </Screen>
  );
}

export function PickupOrderScreen({ orderId }: { orderId: string }) {
  const { data, markCollected } = useStore();
  const order = data.orders.find((entry) => entry.id === orderId);
  const [error, setError] = useState("");
  if (!order) {
    return (
      <Screen title="Pickup" backHref="/pickup/">
        <Empty title="Order not found" body="It may already have been collected." />
      </Screen>
    );
  }
  const canCollect = order.status === "PENDING_BALANCE" && order.balancePaidPaise > 0;
  return (
    <Screen
      title={order.studentName}
      eyebrow={order.id}
      backHref="/pickup/"
      footer={
        <Button className="w-full" disabled={!canCollect} onClick={() => void fail(markCollected(order.id), setError)}>
          {canCollect ? "Mark collected" : "Waiting for balance"}
        </Button>
      }
    >
      <StatusBadge status={order.status} />
      <p className="mt-3 text-sm">Slot {order.slotLabel}</p>
      <Card className="mt-4">
        {order.items.map((item) => (
          <p key={item.menuItemId} className="py-1 font-semibold">
            {item.quantity} × {item.nameSnapshot}
          </p>
        ))}
        <p className="mt-2 text-sm text-muted">
          Balance {formatInr(order.balancePaidPaise)} of {formatInr(order.balanceDuePaise)} verified
        </p>
      </Card>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </Screen>
  );
}

function OrderRow({ order, href }: { order: Order; href: string }) {
  return (
    <Card onClick={() => navigate(href)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{order.studentName}</p>
          <p className="text-sm text-muted">{order.slotLabel}</p>
          <p className="mt-2 text-sm">{order.items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(", ")}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
    </Card>
  );
}

function StaffProfile() {
  return (
    <button type="button" className="mr-2 text-sm font-bold text-accent" onClick={() => navigate("/profile/")}>
      Profile
    </button>
  );
}

async function fail(result: Promise<{ ok: boolean; error?: string }>, setError: (value: string) => void) {
  const settled = await result;
  if (!settled.ok) setError(settled.error ?? "Something went wrong.");
  else setError("");
}
