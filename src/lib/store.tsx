"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { PaymentCancelledError, openRazorpayCheckout } from "@/lib/payments";
import type {
  AppData,
  Category,
  MenuItem,
  OrderStatus,
  PaymentKind,
  PickupSlot,
  RazorpayCheckoutOptions,
  Role,
  User,
} from "@/lib/types";

const TOKEN_KEY = "campusbite.token";
const CART_KEY = "campusbite.cart";

type Result<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true } & T)
  | { ok: false; error: string };

type Store = {
  ready: boolean;
  problem: string | null;
  data: AppData;
  user: User | null;
  login: (email: string, password: string) => Promise<Result>;
  register: (name: string, email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  addToCart: (itemId: string) => Result;
  setQuantity: (itemId: string, quantity: number) => void;
  selectSlot: (slotId: string) => Result;
  placeOrder: () => Promise<Result<{ orderId: string }>>;
  cancelOrder: (orderId: string) => Promise<Result>;
  payAdvance: (orderId: string) => Promise<Result>;
  payBalance: (orderId: string) => Promise<Result>;
  markPreparing: (orderId: string) => Promise<Result>;
  markReady: (orderId: string) => Promise<Result>;
  markCollected: (orderId: string) => Promise<Result>;
  markNotificationRead: (id: string) => Promise<void>;
  saveMenuItem: (item: MenuItem, isNew: boolean) => Promise<Result>;
  deleteMenuItem: (itemId: string) => Promise<Result>;
  saveSlot: (slot: PickupSlot, isNew: boolean) => Promise<Result>;
  setUserRole: (userId: string, role: Role) => Promise<Result>;
  deleteUser: (userId: string) => Promise<Result>;
  createStaff: (name: string, email: string, password: string, role: Role) => Promise<Result>;
};

type StatePayload = {
  user: User | null;
  users: User[];
  menu: AppData["menu"];
  slots: AppData["slots"];
  orders: AppData["orders"];
  notifications: AppData["notifications"];
};

const emptyData: AppData = {
  users: [],
  sessionUserId: null,
  menu: [],
  slots: [],
  orders: [],
  notifications: [],
  cart: [],
  selectedSlotId: null,
};

const listeners = new Set<() => void>();
let snapshot: AppData = emptyData;
let ready = false;
let problem: string | null = null;
let started = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { cart: [], selectedSlotId: null as string | null };
    const parsed = JSON.parse(raw) as { cart?: AppData["cart"]; selectedSlotId?: string | null };
    return {
      cart: Array.isArray(parsed.cart) ? parsed.cart : [],
      selectedSlotId: parsed.selectedSlotId ?? null,
    };
  } catch {
    return { cart: [], selectedSlotId: null as string | null };
  }
}

function writeCart(cart: AppData["cart"], selectedSlotId: string | null) {
  localStorage.setItem(CART_KEY, JSON.stringify({ cart, selectedSlotId }));
  snapshot = { ...snapshot, cart, selectedSlotId };
  emit();
}

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const currentToken = token();
  if (currentToken) headers.set("Authorization", `Bearer ${currentToken}`);
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401) localStorage.removeItem(TOKEN_KEY);
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

function applyState(state: StatePayload) {
  const local = readCart();
  if (token() && !state.user) localStorage.removeItem(TOKEN_KEY);
  snapshot = {
    ...state,
    sessionUserId: state.user?.id ?? null,
    cart: local.cart,
    selectedSlotId: local.selectedSlotId,
  };
}

async function refresh() {
  const state = await request<StatePayload>("/api/state/");
  applyState(state);
  emit();
}

async function bootstrap() {
  try {
    await refresh();
    problem = null;
  } catch (error) {
    problem = error instanceof Error ? error.message : "The canteen database is unavailable.";
    snapshot = { ...emptyData, ...readCart() };
  } finally {
    ready = true;
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started && typeof window !== "undefined") {
    started = true;
    void bootstrap();
  }
  return () => listeners.delete(listener);
}

async function attempt(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, () => snapshot, () => emptyData);
  const isReady = useSyncExternalStore(subscribe, () => ready, () => false);
  const loadProblem = useSyncExternalStore(subscribe, () => problem, () => null);
  const sessionUser = data.sessionUserId
    ? (data.users.find((entry) => entry.id === data.sessionUserId) ?? null)
    : null;

  const api = useMemo<Store>(() => {
    const pay = async (orderId: string, kind: PaymentKind): Promise<Result> => {
      try {
        const checkout = await request<RazorpayCheckoutOptions>("/api/payments/razorpay/order/", {
          method: "POST",
          body: JSON.stringify({ orderId, kind }),
        });
        const result = await openRazorpayCheckout(checkout);
        await request("/api/payments/razorpay/verify/", {
          method: "POST",
          body: JSON.stringify(result),
        });
        await refresh();
        return { ok: true };
      } catch (error) {
        if (error instanceof PaymentCancelledError) {
          return { ok: false, error: error.message };
        }
        await refresh().catch(() => {});
        return { ok: false, error: error instanceof Error ? error.message : "Payment failed." };
      }
    };

    return {
      ready: isReady,
      problem: loadProblem,
      data,
      user: sessionUser,
      login: async (email, password) => {
        try {
          const result = await request<{ token: string }>("/api/auth/login/", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          localStorage.setItem(TOKEN_KEY, result.token);
          await refresh();
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
        }
      },
      register: async (name, email, password) => {
        try {
          const result = await request<{ token: string }>("/api/auth/register/", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
          });
          localStorage.setItem(TOKEN_KEY, result.token);
          await refresh();
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
        }
      },
      logout: async () => {
        try {
          await request("/api/auth/logout/", { method: "POST" });
        } catch {
          // The local session still ends if the server is unreachable.
        }
        localStorage.removeItem(TOKEN_KEY);
        writeCart([], null);
        await refresh().catch(() => {
          snapshot = { ...emptyData };
          emit();
        });
      },
      addToCart: (itemId) => {
        const item = data.menu.find((entry) => entry.id === itemId);
        if (!item || !item.isAvailable) return { ok: false, error: "That dish is unavailable." };
        const existing = data.cart.find((line) => line.itemId === itemId);
        const cart = existing
          ? data.cart.map((line) =>
              line.itemId === itemId ? { ...line, quantity: Math.min(10, line.quantity + 1) } : line,
            )
          : [...data.cart, { itemId, quantity: 1 }];
        writeCart(cart, data.selectedSlotId);
        return { ok: true };
      },
      setQuantity: (itemId, quantity) => {
        const nextQuantity = Math.min(10, quantity);
        const exists = data.cart.some((line) => line.itemId === itemId);
        const cart =
          nextQuantity <= 0
            ? data.cart.filter((line) => line.itemId !== itemId)
            : exists
              ? data.cart.map((line) => (line.itemId === itemId ? { ...line, quantity: nextQuantity } : line))
              : [...data.cart, { itemId, quantity: nextQuantity }];
        writeCart(cart, data.selectedSlotId);
      },
      selectSlot: (slotId) => {
        const slot = data.slots.find((entry) => entry.id === slotId);
        if (!slot || !slot.isAvailable || slot.reservedCount >= slot.capacity) {
          return { ok: false, error: "That pickup slot is full. Choose another." };
        }
        writeCart(data.cart, slotId);
        return { ok: true };
      },
      placeOrder: async () => {
        if (!sessionUser || sessionUser.role !== "student") {
          return { ok: false, error: "Sign in as a student to order." };
        }
        if (data.cart.length === 0) return { ok: false, error: "Your cart is empty." };
        if (!data.selectedSlotId) return { ok: false, error: "Choose an open pickup slot." };
        try {
          const created = await request<{ orderId: string }>("/api/orders/", {
            method: "POST",
            body: JSON.stringify({
              slotId: data.selectedSlotId,
              items: data.cart.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
            }),
          });
          writeCart([], null);
          await refresh();
          return { ok: true, orderId: created.orderId };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
        }
      },
      cancelOrder: (orderId) =>
        attempt(async () => {
          await request(`/api/orders/${orderId}/`, { method: "POST", body: JSON.stringify({ action: "cancel" }) });
          await refresh();
        }),
      payAdvance: (orderId) => pay(orderId, "advance"),
      payBalance: (orderId) => pay(orderId, "balance"),
      markPreparing: (orderId) =>
        attempt(async () => {
          await request(`/api/orders/${orderId}/`, { method: "POST", body: JSON.stringify({ action: "preparing" }) });
          await refresh();
        }),
      markReady: (orderId) =>
        attempt(async () => {
          await request(`/api/orders/${orderId}/`, { method: "POST", body: JSON.stringify({ action: "ready" }) });
          await refresh();
        }),
      markCollected: (orderId) =>
        attempt(async () => {
          await request(`/api/orders/${orderId}/`, { method: "POST", body: JSON.stringify({ action: "collected" }) });
          await refresh();
        }),
      markNotificationRead: async (id) => {
        await request(`/api/notifications/${id}/`, { method: "POST" });
        await refresh();
      },
      saveMenuItem: (item, isNew) =>
        attempt(async () => {
          if (isNew) await request("/api/menu/", { method: "POST", body: JSON.stringify(item) });
          else await request(`/api/menu/${item.id}/`, { method: "PATCH", body: JSON.stringify(item) });
          await refresh();
        }),
      deleteMenuItem: (itemId) =>
        attempt(async () => {
          await request(`/api/menu/${itemId}/`, { method: "DELETE" });
          await refresh();
        }),
      saveSlot: (slot, isNew) =>
        attempt(async () => {
          if (isNew) await request("/api/slots/", { method: "POST", body: JSON.stringify(slot) });
          else await request(`/api/slots/${slot.id}/`, { method: "PATCH", body: JSON.stringify(slot) });
          await refresh();
        }),
      setUserRole: (userId, role) =>
        attempt(async () => {
          await request(`/api/users/${userId}/`, { method: "PATCH", body: JSON.stringify({ role }) });
          await refresh();
        }),
      deleteUser: (userId) =>
        attempt(async () => {
          await request(`/api/users/${userId}/`, { method: "DELETE" });
          await refresh();
        }),
      createStaff: (name, email, password, role) =>
        attempt(async () => {
          await request("/api/users/", {
            method: "POST",
            body: JSON.stringify({ name, email, password, role }),
          });
          await refresh();
        }),
    };
  }, [data, isReady, loadProblem, sessionUser]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

export function cartCount(lines: AppData["cart"]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartSubtotal(data: AppData) {
  return data.cart.reduce((sum, line) => {
    const item = data.menu.find((entry) => entry.id === line.itemId);
    return sum + (item ? item.pricePaise * line.quantity : 0);
  }, 0);
}

export function statusLabel(status: OrderStatus) {
  switch (status) {
    case "PENDING_ADVANCE":
      return "Awaiting advance";
    case "CONFIRMED":
      return "Confirmed";
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_PICKUP":
      return "Ready";
    case "PENDING_BALANCE":
      return "Balance paid";
    case "COMPLETED":
      return "Collected";
    case "CANCELLED":
      return "Cancelled";
  }
}

export const categories: Array<Category | "All"> = ["All", "Meals", "Snacks", "Drinks", "Sweets"];
