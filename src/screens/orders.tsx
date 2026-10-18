"use client";

import { Button, Card, Empty, Screen, StatusBadge } from "@/components/ui";
import { formatInr } from "@/lib/money";
import { homeFor, navigate } from "@/lib/paths";
import { useStore } from "@/lib/store";
import type { Order, OrderStatus } from "@/lib/types";

const steps: OrderStatus[] = [
  "PENDING_ADVANCE",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PENDING_BALANCE",
  "COMPLETED",
];

export function OrdersScreen() {
  const { data, user } = useStore();
  const orders = data.orders.filter((order) => order.userId === user?.id);
  return (
    <Screen title="Orders" eyebrow="Your history" showTabs>
      {orders.length === 0 ? (
        <Empty
          title="No orders yet"
          body="A confirmed advance is what sends an order to the kitchen."
          action={<Button onClick={() => navigate("/menu/")}>Browse menu</Button>}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} onClick={() => navigate(`/orders/${order.id}/`)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{order.id}</p>
                  <h2 className="mt-1 font-bold">{order.items.map((item) => item.nameSnapshot).join(", ")}</h2>
                  <p className="mt-1 text-sm text-muted">{order.slotLabel}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-3 font-bold">{formatInr(order.subtotalPaise)}</p>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function OrderScreen({ orderId }: { orderId: string }) {
  const { data, user, cancelOrder } = useStore();
  const order = data.orders.find((entry) => entry.id === orderId && entry.userId === user?.id);
  if (!order) {
    return (
      <Screen title="Order" backHref="/orders/" showTabs={false}>
        <Empty title="Order not found" body="You can only open your own orders." />
      </Screen>
    );
  }
  return (
    <Screen title={order.id} eyebrow="Order" backHref="/orders/">
      <StatusBadge status={order.status} />
      <ol className="mt-4 space-y-2">
        {steps.map((step) => {
          const reached = steps.indexOf(step) <= steps.indexOf(order.status) && order.status !== "CANCELLED";
          return (
            <li key={step} className={`text-sm ${reached ? "font-bold text-green" : "text-muted"}`}>
              {reached ? "●" : "○"} {step.replaceAll("_", " ").toLowerCase()}
            </li>
          );
        })}
      </ol>
      <Card className="mt-4">
        {order.items.map((item) => (
          <div key={item.menuItemId} className="flex justify-between py-1 text-sm">
            <span>
              {item.nameSnapshot} × {item.quantity}
            </span>
            <span>{formatInr(item.lineTotalPaise)}</span>
          </div>
        ))}
        <div className="mt-2 border-t border-line pt-2 text-sm">
          <p className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatInr(order.subtotalPaise)}</span></p>
          <p className="flex justify-between"><span className="text-muted">Advance</span><span>{formatInr(order.advancePaidPaise)} / {formatInr(order.advanceDuePaise)}</span></p>
          <p className="flex justify-between"><span className="text-muted">Balance</span><span>{formatInr(order.balancePaidPaise)} / {formatInr(order.balanceDuePaise)}</span></p>
          <p className="mt-2 font-semibold">Pickup {order.slotLabel}</p>
        </div>
      </Card>
      <OrderAction order={order} onCancel={() => void cancelOrder(order.id)} />
    </Screen>
  );
}

function OrderAction({ order, onCancel }: { order: Order; onCancel: () => void }) {
  if (order.status === "PENDING_ADVANCE") {
    return (
      <div className="mt-4 space-y-3">
        <Button className="w-full" onClick={() => navigate(`/checkout/pay/?order=${order.id}`)}>
          Pay advance {formatInr(order.advanceDuePaise)}
        </Button>
        <Button variant="danger" className="w-full" onClick={onCancel}>
          Cancel order
        </Button>
      </div>
    );
  }
  if (order.status === "READY_FOR_PICKUP") {
    return (
      <Button className="mt-4 w-full" onClick={() => navigate(`/orders/${order.id}/balance/`)}>
        Pay balance {formatInr(order.balanceDuePaise)}
      </Button>
    );
  }
  if (order.status === "PENDING_BALANCE") {
    return <p className="mt-4 text-sm leading-6 text-muted">Balance verified. Collect it at the counter during {order.slotLabel}.</p>;
  }
  if (order.status === "CONFIRMED" || order.status === "PREPARING") {
    return <p className="mt-4 text-sm leading-6 text-muted">The kitchen has this order. You will get an alert when it is ready.</p>;
  }
  if (order.status === "COMPLETED") {
    return <p className="mt-4 text-sm leading-6 text-muted">Collected. This order is closed.</p>;
  }
  return <p className="mt-4 text-sm leading-6 text-muted">This order was cancelled before the advance was verified.</p>;
}

export function NotificationsScreen() {
  const { data, user, markNotificationRead } = useStore();
  const notices = data.notifications.filter((notice) => notice.userId === user?.id);
  return (
    <Screen title="Alerts" showTabs>
      {notices.length === 0 ? (
        <Empty title="You're caught up" body="A ready alert appears here when the kitchen finishes your order." />
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card
              key={notice.id}
              onClick={() => {
                void markNotificationRead(notice.id);
                navigate(`/orders/${notice.orderId}/`);
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-gold">Ready</p>
              <p className={`mt-1 text-sm leading-6 ${notice.readAt ? "text-muted" : "font-semibold"}`}>{notice.message}</p>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function ProfileScreen() {
  const { user, logout } = useStore();
  if (!user) return null;
  const student = user.role === "student";
  return (
    <Screen title="Profile" showTabs={student} backHref={student ? undefined : homeFor(user.role)}>
      <Card>
        <p className="text-2xl font-extrabold text-green">{user.name}</p>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-accent">{user.role}</p>
      </Card>
      <div className="mt-4">
        <Button
          variant="dark"
          className="w-full"
          onClick={() => {
            void logout().then(() => navigate("/"));
          }}
        >
          Sign out
        </Button>
      </div>
    </Screen>
  );
}
