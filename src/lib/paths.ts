import type { Role } from "@/lib/types";

export type Route =
  | { name: "splash" }
  | { name: "login" }
  | { name: "register" }
  | { name: "forgot" }
  | { name: "unauthorized" }
  | { name: "menu" }
  | { name: "item"; itemId: string }
  | { name: "cart" }
  | { name: "slot" }
  | { name: "review" }
  | { name: "pay"; orderId: string | null }
  | { name: "orders" }
  | { name: "order"; orderId: string }
  | { name: "balance"; orderId: string }
  | { name: "notifications" }
  | { name: "profile" }
  | { name: "kitchen" }
  | { name: "kitchen-order"; orderId: string }
  | { name: "pickup" }
  | { name: "pickup-order"; orderId: string }
  | { name: "admin" }
  | { name: "admin-menu" }
  | { name: "menu-form"; itemId: string | null }
  | { name: "admin-slots" }
  | { name: "slot-form"; slotId: string | null }
  | { name: "admin-staff" }
  | { name: "not-found" };

const NAV_EVENT = "campusbite:nav";

export function withSlash(href: string) {
  const [path, query] = href.split("?");
  const clean = `/${path.split("/").filter(Boolean).join("/")}`;
  const slashed = clean === "/" ? "/" : `${clean}/`;
  return query ? `${slashed}?${query}` : slashed;
}

export function navigate(href: string) {
  const next = withSlash(href);
  const current = window.location.pathname + window.location.search;
  if (current === next) {
    window.dispatchEvent(new Event(NAV_EVENT));
    return;
  }
  window.history.pushState(null, "", next);
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function replace(href: string) {
  const next = withSlash(href);
  if (window.location.pathname + window.location.search === next) return;
  window.history.replaceState(null, "", next);
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

export function currentHref() {
  return window.location.pathname + window.location.search;
}

export function parseHref(href: string): Route {
  const url = new URL(href, "https://campusbite.local");
  const parts = url.pathname.split("/").filter(Boolean);
  const [a, b, c] = parts;

  if (!a) return { name: "splash" };
  if (a === "login") return { name: "login" };
  if (a === "register") return { name: "register" };
  if (a === "forgot-password") return { name: "forgot" };
  if (a === "unauthorized") return { name: "unauthorized" };
  if (a === "menu" && b) return { name: "item", itemId: b };
  if (a === "menu") return { name: "menu" };
  if (a === "cart") return { name: "cart" };
  if (a === "checkout" && b === "slot") return { name: "slot" };
  if (a === "checkout" && b === "review") return { name: "review" };
  if (a === "checkout" && b === "pay") {
    return { name: "pay", orderId: url.searchParams.get("order") };
  }
  if (a === "orders" && b && c === "balance") return { name: "balance", orderId: b };
  if (a === "orders" && b) return { name: "order", orderId: b };
  if (a === "orders") return { name: "orders" };
  if (a === "notifications") return { name: "notifications" };
  if (a === "profile") return { name: "profile" };
  if (a === "kitchen" && b) return { name: "kitchen-order", orderId: b };
  if (a === "kitchen") return { name: "kitchen" };
  if (a === "pickup" && b) return { name: "pickup-order", orderId: b };
  if (a === "pickup") return { name: "pickup" };
  if (a === "admin" && b === "menu" && c === "new") return { name: "menu-form", itemId: null };
  if (a === "admin" && b === "menu" && c) return { name: "menu-form", itemId: c };
  if (a === "admin" && b === "menu") return { name: "admin-menu" };
  if (a === "admin" && b === "slots" && c === "new") return { name: "slot-form", slotId: null };
  if (a === "admin" && b === "slots" && c) return { name: "slot-form", slotId: c };
  if (a === "admin" && b === "slots") return { name: "admin-slots" };
  if (a === "admin" && b === "staff") return { name: "admin-staff" };
  if (a === "admin") return { name: "admin" };
  return { name: "not-found" };
}

export function homeFor(role: Role) {
  if (role === "kitchen") return "/kitchen/";
  if (role === "pickup") return "/pickup/";
  if (role === "admin") return "/admin/";
  return "/menu/";
}

const publicRoutes = new Set<Route["name"]>(["splash", "login", "register", "forgot"]);

export function isPublic(route: Route) {
  return publicRoutes.has(route.name);
}

export function canAccess(role: Role, route: Route) {
  if (route.name === "unauthorized" || route.name === "not-found" || route.name === "splash") {
    return true;
  }
  if (route.name === "profile") return true;
  if (role === "student") {
    return [
      "menu",
      "item",
      "cart",
      "slot",
      "review",
      "pay",
      "orders",
      "order",
      "balance",
      "notifications",
    ].includes(route.name);
  }
  if (role === "kitchen") return route.name === "kitchen" || route.name === "kitchen-order";
  if (role === "pickup") return route.name === "pickup" || route.name === "pickup-order";
  return [
    "admin",
    "admin-menu",
    "menu-form",
    "admin-slots",
    "slot-form",
    "admin-staff",
  ].includes(route.name);
}

export function isStudentTab(route: Route) {
  return ["menu", "orders", "notifications", "profile"].includes(route.name);
}

export function isRootScreen(route: Route) {
  return ["splash", "menu", "orders", "notifications", "profile", "kitchen", "pickup", "admin", "login"].includes(
    route.name,
  );
}

