import type { PoolClient } from "pg";
import { splitPayment } from "@/lib/money";
import { hashPassword, hashToken, HttpError, newToken, nid, query, verifyPassword, withTransaction } from "@/lib/db";
import type { Category, MenuItem, Order, OrderStatus, PickupSlot, Role, User } from "@/lib/types";

const categories = new Set<Category>(["Meals", "Snacks", "Drinks", "Sweets"]);

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
};

type PublicUser = Omit<User, never>;

function publicUser(row: Pick<UserRow, "id" | "name" | "email" | "role">): PublicUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export async function readUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const rows = await query<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [hashToken(token)],
  );
  return rows[0] ? publicUser(rows[0]) : null;
}

export async function requireUser(request: Request) {
  const user = await readUser(request);
  if (!user) throw new HttpError("Sign in to continue.", 401);
  return user;
}

function requireRole(user: PublicUser, allowed: Role[]) {
  if (!allowed.includes(user.role)) throw new HttpError("You cannot do that with this account.", 403);
}

function accountFields(name: string, email: string, password: string) {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedName.length < 2) throw new HttpError("Enter your name.", 400);
  if (!trimmedEmail.includes("@")) throw new HttpError("Enter a valid email.", 400);
  if (password.length < 6) throw new HttpError("Use at least 6 characters.", 400);
  return { trimmedName, trimmedEmail };
}

export async function registerAccount(name: string, email: string, password: string) {
  const { trimmedName, trimmedEmail } = accountFields(name, email, password);
  const passwordHash = await hashPassword(password);
  const role: Role = "student";
  return withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(481516)`);
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [trimmedEmail]);
    if (existing.rowCount) throw new HttpError("An account with that email already exists.", 409);
    const id = nid("u");
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
      [id, trimmedName, trimmedEmail, passwordHash, role],
    );
    const token = await insertSession(client, id);
    return { token, user: { id, name: trimmedName, email: trimmedEmail, role } satisfies PublicUser };
  });
}

export async function createStaffAccount(
  actor: PublicUser,
  name: string,
  email: string,
  password: string,
  role: Role,
) {
  requireRole(actor, ["admin"]);
  if (role !== "kitchen" && role !== "pickup") {
    throw new HttpError("An administrator can create kitchen and pickup accounts.", 400);
  }
  const { trimmedName, trimmedEmail } = accountFields(name, email, password);
  const passwordHash = await hashPassword(password);
  await withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [trimmedEmail]);
    if (existing.rowCount) throw new HttpError("An account with that email already exists.", 409);
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
      [nid("u"), trimmedName, trimmedEmail, passwordHash, role],
    );
  });
}

export async function loginAccount(email: string, password: string) {
  const rows = await query<UserRow>(
    `SELECT id, name, email, password_hash, role FROM users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new HttpError("Those details don't match an account.", 401);
  }
  const token = newToken();
  await query(`INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)`, [hashToken(token), row.id]);
  return { token, user: publicUser(row) };
}

export async function logoutAccount(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return;
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

async function insertSession(client: PoolClient, userId: string) {
  const token = newToken();
  await client.query(`INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)`, [hashToken(token), userId]);
  return token;
}

export async function loadState(user: PublicUser | null) {
  const menu = await query<MenuItem & { price_paise: number; is_available: boolean }>(
    `SELECT id, name, description, category, price_paise, is_available, veg, emoji
     FROM menu_items ORDER BY created_at ASC`,
  );
  const slots = await query<PickupSlot & { window_label: string; reserved_count: number; is_available: boolean }>(
    `SELECT id, label, window_label, capacity, reserved_count, is_available
     FROM pickup_slots ORDER BY created_at ASC`,
  );
  const orders = user ? await loadOrders(user) : [];
  const notifications = user
    ? await query<{
        id: string;
        user_id: string;
        order_id: string;
        type: "ready";
        message: string;
        created_at: Date;
        read_at: Date | null;
      }>(
        `SELECT id, user_id, order_id, type, message, created_at, read_at
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
        [user.id],
      )
    : [];
  const users = await visibleUsers(user, orders);
  if (user && !users.some((entry) => entry.id === user.id)) users.unshift(user);
  return {
    user,
    users,
    menu: menu.map(mapMenu),
    slots: slots.map(mapSlot),
    orders,
    notifications: notifications.map((notice) => ({
      id: notice.id,
      userId: notice.user_id,
      orderId: notice.order_id,
      type: notice.type,
      message: notice.message,
      createdAt: notice.created_at.toISOString(),
      readAt: notice.read_at ? notice.read_at.toISOString() : null,
    })),
  };
}

function mapMenu(row: {
  id: string;
  name: string;
  description: string;
  category: Category;
  price_paise: number;
  is_available: boolean;
  veg: boolean;
  emoji: string;
}): MenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    pricePaise: row.price_paise,
    isAvailable: row.is_available,
    veg: row.veg,
    emoji: row.emoji,
  };
}

function mapSlot(row: {
  id: string;
  label: string;
  window_label: string;
  capacity: number;
  reserved_count: number;
  is_available: boolean;
}): PickupSlot {
  return {
    id: row.id,
    label: row.label,
    windowLabel: row.window_label,
    capacity: row.capacity,
    reservedCount: row.reserved_count,
    isAvailable: row.is_available,
  };
}

async function loadOrders(user: PublicUser): Promise<Order[]> {
  const filter =
    user.role === "student"
      ? { sql: "WHERE o.user_id = $1", values: [user.id] }
      : user.role === "kitchen"
        ? { sql: "WHERE o.status IN ('CONFIRMED', 'PREPARING')", values: [] }
        : user.role === "pickup"
          ? { sql: "WHERE o.status IN ('READY_FOR_PICKUP', 'PENDING_BALANCE')", values: [] }
          : { sql: "", values: [] };
  const orderRows = await query<{
    id: string;
    user_id: string;
    student_name: string;
    subtotal_paise: number;
    advance_due_paise: number;
    balance_due_paise: number;
    advance_paid_paise: number;
    balance_paid_paise: number;
    slot_id: string;
    slot_label: string;
    status: OrderStatus;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT o.id, o.user_id, u.name AS student_name, o.subtotal_paise, o.advance_due_paise,
            o.balance_due_paise, o.advance_paid_paise, o.balance_paid_paise, o.slot_id,
            o.slot_label, o.status, o.created_at, o.updated_at
     FROM orders o
     JOIN users u ON u.id = o.user_id
     ${filter.sql}
     ORDER BY o.created_at DESC`,
    filter.values,
  );
  if (orderRows.length === 0) return [];
  const items = await query<{
    order_id: string;
    menu_item_id: string | null;
    name_snapshot: string;
    quantity: number;
    unit_price_paise: number;
    line_total_paise: number;
  }>(
    `SELECT order_id, menu_item_id, name_snapshot, quantity, unit_price_paise, line_total_paise
     FROM order_items WHERE order_id = ANY($1::text[])`,
    [orderRows.map((order) => order.id)],
  );
  return orderRows.map((order) => ({
    id: order.id,
    userId: order.user_id,
    studentName: order.student_name,
    items: items
      .filter((item) => item.order_id === order.id)
      .map((item) => ({
        menuItemId: item.menu_item_id ?? "",
        nameSnapshot: item.name_snapshot,
        quantity: item.quantity,
        unitPricePaise: item.unit_price_paise,
        lineTotalPaise: item.line_total_paise,
      })),
    subtotalPaise: order.subtotal_paise,
    advanceDuePaise: order.advance_due_paise,
    balanceDuePaise: order.balance_due_paise,
    advancePaidPaise: order.advance_paid_paise,
    balancePaidPaise: order.balance_paid_paise,
    slotId: order.slot_id,
    slotLabel: order.slot_label,
    status: order.status,
    createdAt: order.created_at.toISOString(),
    updatedAt: order.updated_at.toISOString(),
  }));
}

async function visibleUsers(user: PublicUser | null, orders: Order[]) {
  if (!user) return [];
  if (user.role === "admin") {
    const rows = await query<Pick<UserRow, "id" | "name" | "email" | "role">>(
      `SELECT id, name, email, role FROM users ORDER BY created_at ASC`,
    );
    return rows.map(publicUser);
  }
  if (user.role === "student") return [user];
  const ids = Array.from(new Set(orders.map((order) => order.userId)));
  if (ids.length === 0) return [];
  const rows = await query<Pick<UserRow, "id" | "name" | "email" | "role">>(
    `SELECT id, name, email, role FROM users WHERE id = ANY($1::text[])`,
    [ids],
  );
  return rows.map(publicUser);
}

export async function saveMenuItem(user: PublicUser, item: MenuItem, isNew: boolean) {
  requireRole(user, ["admin"]);
  const name = item.name.trim();
  const description = item.description.trim();
  if (!name) throw new HttpError("Enter a dish name.", 400);
  if (!categories.has(item.category)) throw new HttpError("Choose a category.", 400);
  if (!Number.isInteger(item.pricePaise) || item.pricePaise <= 0) {
    throw new HttpError("Enter a price greater than zero.", 400);
  }
  if (isNew) {
    const id = nid("dish");
    await query(
      `INSERT INTO menu_items (id, name, description, category, price_paise, is_available, veg, emoji)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, name, description, item.category, item.pricePaise, item.isAvailable, item.veg, item.emoji.trim() || "🍽️"],
    );
    return;
  }
  const updated = await query(`UPDATE menu_items SET name = $2, description = $3, category = $4, price_paise = $5,
    is_available = $6, veg = $7, emoji = $8 WHERE id = $1 RETURNING id`, [
    item.id,
    name,
    description,
    item.category,
    item.pricePaise,
    item.isAvailable,
    item.veg,
    item.emoji.trim() || "🍽️",
  ]);
  if (!updated.length) throw new HttpError("That dish is not on the menu.", 404);
}

export async function saveSlot(user: PublicUser, slot: PickupSlot, isNew: boolean) {
  requireRole(user, ["admin"]);
  const label = slot.label.trim();
  const windowLabel = slot.windowLabel.trim() || label;
  if (!label) throw new HttpError("Enter the slot time.", 400);
  if (!Number.isInteger(slot.capacity) || slot.capacity < 1) {
    throw new HttpError("Capacity must be at least 1.", 400);
  }
  if (isNew) {
    await query(
      `INSERT INTO pickup_slots (id, label, window_label, capacity, reserved_count, is_available)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [nid("slot"), label, windowLabel, slot.capacity, slot.isAvailable],
    );
    return;
  }
  const current = await query<{ reserved_count: number }>(
    `SELECT reserved_count FROM pickup_slots WHERE id = $1`,
    [slot.id],
  );
  if (!current[0]) throw new HttpError("That slot does not exist.", 404);
  if (slot.capacity < current[0].reserved_count) {
    throw new HttpError("Capacity cannot be below the current reservations.", 400);
  }
  await query(
    `UPDATE pickup_slots SET label = $2, window_label = $3, capacity = $4, is_available = $5 WHERE id = $1`,
    [slot.id, label, windowLabel, slot.capacity, slot.isAvailable],
  );
}

export async function setUserRole(actor: PublicUser, userId: string, role: Role) {
  requireRole(actor, ["admin"]);
  if (role !== "student" && role !== "kitchen" && role !== "pickup") {
    throw new HttpError("Administrator accounts stay as they are in the database.", 400);
  }
  await withTransaction(async (client) => {
    const target = await client.query<{ role: Role }>(`SELECT role FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    if (!target.rowCount) throw new HttpError("Account not found.", 404);
    if (target.rows[0].role === "admin") {
      throw new HttpError("Administrator accounts stay as they are in the database.", 400);
    }
    await client.query(`UPDATE users SET role = $2 WHERE id = $1`, [userId, role]);
  });
}

export async function placeOrder(user: PublicUser, slotId: string, lines: { itemId: string; quantity: number }[]) {
  requireRole(user, ["student"]);
  if (!Array.isArray(lines) || lines.length === 0) throw new HttpError("Your cart is empty.", 400);
  return withTransaction(async (client) => {
    const slot = await client.query<{
      id: string;
      label: string;
      capacity: number;
      reserved_count: number;
      is_available: boolean;
    }>(`SELECT id, label, capacity, reserved_count, is_available FROM pickup_slots WHERE id = $1 FOR UPDATE`, [slotId]);
    const picked = slot.rows[0];
    if (!picked || !picked.is_available || picked.reserved_count >= picked.capacity) {
      throw new HttpError("That pickup slot is full. Choose another.", 409);
    }
    const items = [];
    for (const line of lines) {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new HttpError("Quantity must be between 1 and 10.", 400);
      }
      const menu = await client.query<{
        id: string;
        name: string;
        price_paise: number;
        is_available: boolean;
      }>(`SELECT id, name, price_paise, is_available FROM menu_items WHERE id = $1`, [line.itemId]);
      const dish = menu.rows[0];
      if (!dish || !dish.is_available) throw new HttpError("A dish in your cart is unavailable.", 409);
      items.push({
        menuItemId: dish.id,
        nameSnapshot: dish.name,
        quantity,
        unitPricePaise: dish.price_paise,
        lineTotalPaise: dish.price_paise * quantity,
      });
    }
    const subtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
    const split = splitPayment(subtotalPaise);
    const orderId = nid("ord");
    await client.query(
      `INSERT INTO orders (
        id, user_id, subtotal_paise, advance_due_paise, balance_due_paise, slot_id, slot_label, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_ADVANCE')`,
      [orderId, user.id, subtotalPaise, split.advanceDuePaise, split.balanceDuePaise, picked.id, picked.label],
    );
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price_paise, line_total_paise)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [nid("line"), orderId, item.menuItemId, item.nameSnapshot, item.quantity, item.unitPricePaise, item.lineTotalPaise],
      );
    }
    await client.query(`UPDATE pickup_slots SET reserved_count = reserved_count + 1 WHERE id = $1`, [picked.id]);
    return { orderId };
  });
}

async function loadOwned(client: PoolClient, orderId: string) {
  const result = await client.query<{
    id: string;
    user_id: string;
    status: OrderStatus;
    slot_id: string;
    advance_due_paise: number;
    balance_due_paise: number;
    balance_paid_paise: number;
  }>(
    `SELECT id, user_id, status, slot_id, advance_due_paise, balance_due_paise, balance_paid_paise
     FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId],
  );
  if (!result.rowCount) throw new HttpError("Order not found.", 404);
  return result.rows[0];
}

export async function actOnOrder(user: PublicUser, orderId: string, action: string) {
  await withTransaction(async (client) => {
    const order = await loadOwned(client, orderId);
    const owns = order.user_id === user.id;
    if (action === "cancel") {
      if (!owns) throw new HttpError("You can only cancel your own order.", 403);
      if (order.status !== "PENDING_ADVANCE") {
        throw new HttpError("Only an unpaid order can be cancelled here.", 409);
      }
      await client.query(`UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`, [orderId]);
      await client.query(
        `UPDATE pickup_slots SET reserved_count = GREATEST(reserved_count - 1, 0) WHERE id = $1`,
        [order.slot_id],
      );
      return;
    }
    if (action === "verify-advance") {
      if (!owns) throw new HttpError("You can only pay for your own order.", 403);
      if (order.status !== "PENDING_ADVANCE") return;
      await client.query(
        `UPDATE orders SET status = 'CONFIRMED', advance_paid_paise = advance_due_paise, updated_at = now() WHERE id = $1`,
        [orderId],
      );
      return;
    }
    if (action === "verify-balance") {
      if (!owns) throw new HttpError("You can only pay for your own order.", 403);
      if (order.status !== "READY_FOR_PICKUP") {
        throw new HttpError("The balance is due once the kitchen marks the order ready.", 409);
      }
      await client.query(
        `UPDATE orders SET status = 'PENDING_BALANCE', balance_paid_paise = balance_due_paise, updated_at = now() WHERE id = $1`,
        [orderId],
      );
      return;
    }
    if (action === "preparing") {
      requireRole(user, ["kitchen", "admin"]);
      if (order.status !== "CONFIRMED") throw new HttpError("Only a confirmed order can start preparation.", 409);
      await client.query(`UPDATE orders SET status = 'PREPARING', updated_at = now() WHERE id = $1`, [orderId]);
      return;
    }
    if (action === "ready") {
      requireRole(user, ["kitchen", "admin"]);
      if (order.status !== "PREPARING") {
        throw new HttpError("Finish preparation before marking the order ready.", 409);
      }
      await client.query(`UPDATE orders SET status = 'READY_FOR_PICKUP', updated_at = now() WHERE id = $1`, [orderId]);
      const existing = await client.query(
        `SELECT id FROM notifications WHERE order_id = $1 AND type = 'ready'`,
        [orderId],
      );
      if (!existing.rowCount) {
        const names = await client.query<{ name_snapshot: string }>(
          `SELECT name_snapshot FROM order_items WHERE order_id = $1`,
          [orderId],
        );
        const label = names.rows.map((row) => row.name_snapshot).join(", ");
        await client.query(
          `INSERT INTO notifications (id, user_id, order_id, type, message) VALUES ($1, $2, $3, 'ready', $4)`,
          [nid("ntf"), order.user_id, orderId, `${label} is ready. Pay the balance before pickup.`],
        );
      }
      return;
    }
    if (action === "collected") {
      requireRole(user, ["pickup", "admin"]);
      if (order.status !== "PENDING_BALANCE" || order.balance_paid_paise <= 0) {
        throw new HttpError("Collect the order only after the balance is verified.", 409);
      }
      await client.query(`UPDATE orders SET status = 'COMPLETED', updated_at = now() WHERE id = $1`, [orderId]);
      return;
    }
    throw new HttpError("Unknown order action.", 400);
  });
}

export async function markNotificationRead(user: PublicUser, id: string) {
  await query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
}
