"use client";

import { useMemo, useState } from "react";
import { IconBag, IconSearch } from "@/components/icons";
import { Button, Card, DietMark, Empty, QtyStepper, Screen } from "@/components/ui";
import { formatInr } from "@/lib/money";
import { navigate } from "@/lib/paths";
import { cartCount, cartSubtotal, categories, useStore } from "@/lib/store";
import type { Category } from "@/lib/types";

export function MenuScreen() {
  const { data } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const count = cartCount(data.cart);
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.menu.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesQuery =
        !needle ||
        item.name.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, data.menu, query]);

  return (
    <Screen title="Menu" eyebrow="Today at the canteen" showTabs>
      <label className="flex h-12 items-center gap-2 rounded-full bg-white px-4 shadow-[0_0_0.5px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.24)]">
        <IconSearch className="h-5 w-5 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search dishes"
          className="w-full bg-transparent text-base outline-none"
        />
      </label>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setCategory(entry)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm font-bold active:scale-95 ${category === entry ? "bg-accent text-white" : "bg-white text-ink"}`}
          >
            {entry}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <Empty
            title={data.menu.length === 0 ? "Menu is empty" : "Nothing matches"}
            body={
              data.menu.length === 0
                ? "An administrator can add today’s dishes from the menu screen."
                : "Try another dish or category."
            }
          />
        ) : (
          items.map((item) => (
            <Card key={item.id} onClick={() => navigate(`/menu/${item.id}/`)} className={item.isAvailable ? "" : "opacity-60"}>
              <div className="flex gap-3">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-ceramic text-3xl">
                  {item.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-green">{item.name}</h2>
                    <span className="shrink-0 font-bold">{formatInr(item.pricePaise)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{item.description}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    <DietMark veg={item.veg} />
                    {item.veg ? "Veg" : "Non-veg"}
                    {!item.isAvailable ? " · Sold out" : ""}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      {count > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex w-full max-w-[480px] justify-end px-4" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={() => navigate("/cart/")}
            className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-[0_0_6px_rgba(0,0,0,0.24),0_8px_12px_rgba(0,0,0,0.14)] active:scale-95"
            aria-label={`Open cart, ${count} items`}
          >
            <IconBag />
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-house">
              {count}
            </span>
          </button>
        </div>
      ) : null}
    </Screen>
  );
}

export function ItemScreen({ itemId }: { itemId: string }) {
  const { data, setQuantity } = useStore();
  const item = data.menu.find((entry) => entry.id === itemId);
  const line = data.cart.find((entry) => entry.itemId === itemId);
  const [quantity, setLocalQuantity] = useState(line?.quantity ?? 1);
  const [error, setError] = useState("");

  if (!item) {
    return (
      <Screen title="Dish" backHref="/menu/">
        <Empty title="Dish unavailable" body="It may have been removed from the menu." />
      </Screen>
    );
  }

  return (
    <Screen
      title={item.name}
      eyebrow={item.category}
      backHref="/menu/"
      footer={
        <Button
          className="w-full"
          disabled={!item.isAvailable}
          onClick={() => {
            if (!item.isAvailable) {
              setError("That dish is unavailable.");
              return;
            }
            setQuantity(item.id, Math.max(1, quantity));
            navigate("/cart/");
          }}
        >
          {item.isAvailable ? `Add · ${formatInr(item.pricePaise * quantity)}` : "Sold out"}
        </Button>
      }
    >
      <div className="grid h-44 place-items-center rounded-xl bg-ceramic text-6xl">{item.emoji}</div>
      <div className="mt-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-muted">
          <DietMark veg={item.veg} />
          {item.veg ? "Vegetarian" : "Non-vegetarian"}
        </p>
        <p className="text-xl font-extrabold text-green">{formatInr(item.pricePaise)}</p>
      </div>
      <p className="mt-3 text-base leading-6 text-ink/80">{item.description}</p>
      {!item.isAvailable ? <p className="mt-4 text-sm font-semibold text-danger">This dish cannot be added to a new order.</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {item.isAvailable ? (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-bold">Quantity</span>
          <QtyStepper value={quantity} onChange={(next) => setLocalQuantity(Math.max(1, Math.min(10, next)))} />
        </div>
      ) : null}
    </Screen>
  );
}

export function CartScreen() {
  const { data, setQuantity } = useStore();
  const subtotal = cartSubtotal(data);
  if (data.cart.length === 0) {
    return (
      <Screen title="Cart" backHref="/menu/">
        <Empty
          title="Cart is empty"
          body="Add a dish from the menu to start an order."
          action={<Button onClick={() => navigate("/menu/")}>Browse menu</Button>}
        />
      </Screen>
    );
  }
  return (
    <Screen
      title="Cart"
      backHref="/menu/"
      footer={
        <Button className="w-full" onClick={() => navigate("/checkout/slot/")}>
          Choose pickup slot · {formatInr(subtotal)}
        </Button>
      }
    >
      <div className="space-y-3">
        {data.cart.map((line) => {
          const item = data.menu.find((entry) => entry.id === line.itemId);
          if (!item) return null;
          return (
            <Card key={line.itemId}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">{item.name}</h2>
                  <p className="text-sm text-muted">{formatInr(item.pricePaise * line.quantity)}</p>
                  {!item.isAvailable ? <p className="text-sm text-danger">Sold out</p> : null}
                </div>
                <QtyStepper value={line.quantity} onChange={(next) => setQuantity(item.id, next)} />
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted">Subtotal {formatInr(subtotal)}. The 20% advance is confirmed on the next screens.</p>
    </Screen>
  );
}
