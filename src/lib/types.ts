export type Role = "student" | "kitchen" | "pickup" | "admin";

export type Category = "Meals" | "Snacks" | "Drinks" | "Sweets";

export type OrderStatus =
  | "PENDING_ADVANCE"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "PENDING_BALANCE"
  | "COMPLETED"
  | "CANCELLED";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: Category;
  pricePaise: number;
  isAvailable: boolean;
  veg: boolean;
  emoji: string;
};

export type PickupSlot = {
  id: string;
  label: string;
  windowLabel: string;
  capacity: number;
  reservedCount: number;
  isAvailable: boolean;
};

export type OrderItem = {
  menuItemId: string;
  nameSnapshot: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type Order = {
  id: string;
  userId: string;
  studentName: string;
  items: OrderItem[];
  subtotalPaise: number;
  advanceDuePaise: number;
  balanceDuePaise: number;
  advancePaidPaise: number;
  balancePaidPaise: number;
  slotId: string;
  slotLabel: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  orderId: string;
  type: "ready";
  message: string;
  createdAt: string;
  readAt: string | null;
};

export type CartLine = {
  itemId: string;
  quantity: number;
};

export type AppData = {
  users: User[];
  sessionUserId: string | null;
  menu: MenuItem[];
  slots: PickupSlot[];
  orders: Order[];
  notifications: AppNotification[];
  cart: CartLine[];
  selectedSlotId: string | null;
};
