"use client";

import { IconBell, IconMenu, IconOrders, IconUser } from "@/components/icons";
import { navigate, parseHref } from "@/lib/paths";
import { useStore } from "@/lib/store";

const tabs = [
  { href: "/menu/", label: "Menu", icon: IconMenu },
  { href: "/orders/", label: "Orders", icon: IconOrders },
  { href: "/notifications/", label: "Alerts", icon: IconBell },
  { href: "/profile/", label: "Profile", icon: IconUser },
];

export function TabBar({ href }: { href: string }) {
  const route = parseHref(href);
  const { data, user } = useStore();
  const unread = data.notifications.filter((notice) => notice.userId === user?.id && !notice.readAt).length;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px]">
      <div className="pointer-events-auto border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="grid h-16 grid-cols-4">
        {tabs.map((tab) => {
          const active =
            (tab.href === "/menu/" && route.name === "menu") ||
            (tab.href === "/orders/" && route.name === "orders") ||
            (tab.href === "/notifications/" && route.name === "notifications") ||
            (tab.href === "/profile/" && route.name === "profile");
          const Icon = tab.icon;
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => navigate(tab.href)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${active ? "text-accent" : "text-muted"}`}
            >
              <Icon className="h-6 w-6" />
              {tab.label}
              {tab.label === "Alerts" && unread > 0 ? (
                <span className="absolute right-6 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] text-house">
                  {unread}
                </span>
              ) : null}
            </button>
          );
        })}
        </div>
      </div>
    </nav>
  );
}
