"use client";

import { useEffect, useSyncExternalStore } from "react";
import { NativeChrome } from "@/components/native-chrome";
import { TabBar } from "@/components/tab-bar";
import {
  canAccess,
  currentHref,
  homeFor,
  isPublic,
  isStudentTab,
  parseHref,
  replace,
  subscribeToLocation,
  type Route,
} from "@/lib/paths";
import { useStore } from "@/lib/store";
import {
  AdminHomeScreen,
  AdminMenuScreen,
  AdminSlotsScreen,
  MenuFormScreen,
  SlotFormScreen,
  StaffScreen,
} from "@/screens/admin";
import { BootScreen, ForgotScreen, LoginScreen, NotFoundScreen, RegisterScreen, SplashScreen, UnauthorizedScreen } from "@/screens/auth";
import { BalanceScreen, PayScreen, ReviewScreen, SlotScreen } from "@/screens/checkout";
import { CartScreen, ItemScreen, MenuScreen } from "@/screens/menu";
import { NotificationsScreen, OrderScreen, OrdersScreen, ProfileScreen } from "@/screens/orders";
import { KitchenOrderScreen, KitchenScreen, PickupOrderScreen, PickupScreen } from "@/screens/staff";

export function App({ initialPath }: { initialPath: string }) {
  const { ready, user } = useStore();
  const href = useSyncExternalStore(subscribeToLocation, currentHref, () => initialPath);
  const route = parseHref(href);

  useEffect(() => {
    if (!ready || route.name === "splash") return;
    if (!user && !isPublic(route)) {
      replace("/login/");
      return;
    }
    if (user && (route.name === "login" || route.name === "register")) {
      replace(homeFor(user.role));
      return;
    }
    if (user && !canAccess(user.role, route)) replace("/unauthorized/");
  }, [ready, route, user]);

  const showTabs = Boolean(user?.role === "student" && isStudentTab(route));

  return (
    <div className="min-h-dvh bg-house">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-canvas text-ink shadow-2xl">
        <NativeChrome route={route} />
        {!ready ? <BootScreen /> : <ScreenRoute route={route} />}
        {showTabs ? <TabBar href={href} /> : null}
      </div>
    </div>
  );
}

function ScreenRoute({ route }: { route: Route }) {
  switch (route.name) {
    case "splash":
      return <SplashScreen />;
    case "login":
      return <LoginScreen />;
    case "register":
      return <RegisterScreen />;
    case "forgot":
      return <ForgotScreen />;
    case "unauthorized":
      return <UnauthorizedScreen />;
    case "menu":
      return <MenuScreen />;
    case "item":
      return <ItemScreen itemId={route.itemId} />;
    case "cart":
      return <CartScreen />;
    case "slot":
      return <SlotScreen />;
    case "review":
      return <ReviewScreen />;
    case "pay":
      return <PayScreen orderId={route.orderId} />;
    case "orders":
      return <OrdersScreen />;
    case "order":
      return <OrderScreen orderId={route.orderId} />;
    case "balance":
      return <BalanceScreen orderId={route.orderId} />;
    case "notifications":
      return <NotificationsScreen />;
    case "profile":
      return <ProfileScreen />;
    case "kitchen":
      return <KitchenScreen />;
    case "kitchen-order":
      return <KitchenOrderScreen orderId={route.orderId} />;
    case "pickup":
      return <PickupScreen />;
    case "pickup-order":
      return <PickupOrderScreen orderId={route.orderId} />;
    case "admin":
      return <AdminHomeScreen />;
    case "admin-menu":
      return <AdminMenuScreen />;
    case "menu-form":
      return <MenuFormScreen itemId={route.itemId} />;
    case "admin-slots":
      return <AdminSlotsScreen />;
    case "slot-form":
      return <SlotFormScreen slotId={route.slotId} />;
    case "admin-staff":
      return <StaffScreen />;
    default:
      return <NotFoundScreen />;
  }
}
