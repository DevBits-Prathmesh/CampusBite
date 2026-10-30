"use client";

import { useState } from "react";
import { Button, Card, ErrorNote, Field, Screen, TextArea, Toggle } from "@/components/ui";
import { formatInr, rupeesToPaise } from "@/lib/money";
import { navigate } from "@/lib/paths";
import { useStore } from "@/lib/store";
import type { Category, MenuItem, PickupSlot, Role } from "@/lib/types";

const categoryOptions: Category[] = ["Meals", "Snacks", "Drinks", "Sweets"];
const assignableRoles: Role[] = ["student", "kitchen", "pickup"];

export function AdminHomeScreen() {
  return (
    <Screen title="Admin" eyebrow="Canteen setup" headerRight={<ProfileLink />}>
      <div className="space-y-3">
        <Card onClick={() => navigate("/admin/menu/")}>
          <h2 className="text-lg font-bold text-green">Menu</h2>
          <p className="text-sm text-muted">Prices, descriptions, and what is available today.</p>
        </Card>
        <Card onClick={() => navigate("/admin/slots/")}>
          <h2 className="text-lg font-bold text-green">Pickup slots</h2>
          <p className="text-sm text-muted">Time windows and how many orders each can hold.</p>
        </Card>
        <Card onClick={() => navigate("/admin/staff/")}>
          <h2 className="text-lg font-bold text-green">Staff</h2>
          <p className="text-sm text-muted">Create kitchen and pickup accounts. Students register themselves.</p>
        </Card>
      </div>
    </Screen>
  );
}

export function AdminMenuScreen() {
  const { data, saveMenuItem, deleteMenuItem } = useStore();
  const [error, setError] = useState("");
  return (
    <Screen
      title="Menu"
      backHref="/admin/"
      footer={<Button className="w-full" onClick={() => navigate("/admin/menu/new/")}>Add dish</Button>}
    >
      <div className="space-y-3">
        {data.menu.map((item) => (
          <Card key={item.id}>
            <button type="button" className="w-full text-left" onClick={() => navigate(`/admin/menu/${item.id}/`)}>
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-bold">{item.name}</span>
                  <span className="text-sm text-muted">{item.category} · {formatInr(item.pricePaise)}</span>
                </span>
                <span className={`text-xs font-bold uppercase ${item.isAvailable ? "text-accent" : "text-danger"}`}>
                  {item.isAvailable ? "On" : "Off"}
                </span>
              </span>
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 w-full text-sm"
                onClick={() => void saveMenuItem({ ...item, isAvailable: !item.isAvailable }, false)}
              >
                {item.isAvailable ? "Mark unavailable" : "Mark available"}
              </Button>
              <Button
                variant="danger"
                className="h-10 w-full text-sm"
                onClick={() => {
                  if (!window.confirm(`Delete "${item.name}" from the menu? Past orders keep their record.`)) return;
                  void deleteMenuItem(item.id).then((result) => setError(result.ok ? "" : result.error));
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </Screen>
  );
}

export function MenuFormScreen({ itemId }: { itemId: string | null }) {
  const { data, saveMenuItem } = useStore();
  const existing = data.menu.find((item) => item.id === itemId);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState<Category>(existing?.category ?? "Meals");
  const [price, setPrice] = useState(existing ? (existing.pricePaise / 100).toFixed(2) : "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "🍽️");
  const [veg, setVeg] = useState(existing?.veg ?? true);
  const [isAvailable, setAvailable] = useState(existing?.isAvailable ?? true);
  const [error, setError] = useState("");

  if (itemId && !existing) {
    return (
      <Screen title="Edit dish" backHref="/admin/menu/">
        <p className="text-sm text-muted">That dish is not on the menu.</p>
      </Screen>
    );
  }

  return (
    <Screen title={itemId ? "Edit dish" : "New dish"} backHref="/admin/menu/">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const pricePaise = rupeesToPaise(price);
          if (pricePaise === null) {
            setError("Enter a price in rupees.");
            return;
          }
          const item: MenuItem = {
            id: existing?.id ?? slugify(name),
            name: name.trim(),
            description: description.trim(),
            category,
            pricePaise,
            isAvailable,
            veg,
            emoji: emoji.trim() || "🍽️",
          };
          void saveMenuItem(item, !existing).then((result) => {
            if (!result.ok) setError(result.error);
            else navigate("/admin/menu/");
          });
        }}
      >
        <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
            className="h-12 w-full rounded border border-[#d6dbde] bg-white px-3"
          >
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <Field label="Price in rupees" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        <Field label="Emoji" value={emoji} onChange={(event) => setEmoji(event.target.value)} />
        <Toggle checked={veg} label="Vegetarian" onChange={setVeg} />
        <Toggle checked={isAvailable} label="Available to order" onChange={setAvailable} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" className="w-full">Save dish</Button>
      </form>
    </Screen>
  );
}

export function AdminSlotsScreen() {
  const { data } = useStore();
  return (
    <Screen
      title="Pickup slots"
      backHref="/admin/"
      footer={<Button className="w-full" onClick={() => navigate("/admin/slots/new/")}>Add slot</Button>}
    >
      <div className="space-y-3">
        {data.slots.map((slot) => (
          <Card key={slot.id} onClick={() => navigate(`/admin/slots/${slot.id}/`)}>
            <p className="font-bold">{slot.windowLabel}</p>
            <p className="text-sm text-muted">
              {slot.reservedCount} reserved · capacity {slot.capacity}
              {slot.isAvailable ? "" : " · hidden"}
            </p>
          </Card>
        ))}
      </div>
    </Screen>
  );
}

export function SlotFormScreen({ slotId }: { slotId: string | null }) {
  const { data, saveSlot } = useStore();
  const existing = data.slots.find((slot) => slot.id === slotId);
  const [label, setLabel] = useState(existing?.label ?? "");
  const [windowLabel, setWindowLabel] = useState(existing?.windowLabel ?? "");
  const [capacity, setCapacity] = useState(String(existing?.capacity ?? 8));
  const [isAvailable, setAvailable] = useState(existing?.isAvailable ?? true);
  const [error, setError] = useState("");

  if (slotId && !existing) {
    return (
      <Screen title="Edit slot" backHref="/admin/slots/">
        <p className="text-sm text-muted">That slot does not exist.</p>
      </Screen>
    );
  }

  return (
    <Screen title={slotId ? "Edit slot" : "New slot"} backHref="/admin/slots/">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const slot: PickupSlot = {
            id: existing?.id ?? `slot-${Date.now().toString(36)}`,
            label: label.trim(),
            windowLabel: windowLabel.trim() || label.trim(),
            capacity: Number(capacity),
            reservedCount: existing?.reservedCount ?? 0,
            isAvailable,
          };
          void saveSlot(slot, !existing).then((result) => {
            if (!result.ok) setError(result.error);
            else navigate("/admin/slots/");
          });
        }}
      >
        <Field label="Short label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="13:00–13:15" />
        <Field label="Window shown to students" value={windowLabel} onChange={(event) => setWindowLabel(event.target.value)} placeholder="13:00 – 13:15" />
        <Field label="Capacity" inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
        <Toggle checked={isAvailable} label="Open for new orders" onChange={setAvailable} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" className="w-full">Save slot</Button>
      </form>
    </Screen>
  );
}

export function StaffScreen() {
  const { data, setUserRole, createStaff, deleteUser } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("kitchen");
  const [error, setError] = useState("");
  return (
    <Screen title="Staff" backHref="/admin/">
      <Card>
        <h2 className="text-lg font-bold text-green">New kitchen or pickup account</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createStaff(name, email, password, role).then((result) => {
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setName("");
              setEmail("");
              setPassword("");
              setRole("kitchen");
              setError("");
            });
          }}
        >
          <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <label className="block text-[13px] font-bold">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="mt-1 h-12 w-full rounded border border-[#d6dbde] bg-white px-3 font-semibold"
            >
              <option value="kitchen">kitchen</option>
              <option value="pickup">pickup</option>
            </select>
          </label>
          <Button type="submit" className="w-full">Create account</Button>
        </form>
      </Card>
      <div className="mt-4 space-y-3">
        {data.users.map((account) => (
          <Card key={account.id}>
            <p className="font-bold">{account.name}</p>
            <p className="text-sm text-muted">{account.email}</p>
            {account.role === "admin" ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-accent">admin</p>
            ) : (
              <label className="mt-3 block text-[13px] font-bold">
                Role
                <select
                  value={account.role}
                  onChange={(event) => {
                    void setUserRole(account.id, event.target.value as Role).then((result) => {
                      setError(result.ok ? "" : result.error);
                    });
                  }}
                  className="mt-1 h-12 w-full rounded border border-[#d6dbde] bg-white px-3 font-semibold"
                >
                  {assignableRoles.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {account.role !== "admin" ? (
              <Button
                variant="danger"
                className="mt-2 h-10 w-full text-sm"
                onClick={() => {
                  if (!window.confirm(`Delete ${account.name}'s account?`)) return;
                  void deleteUser(account.id).then((result) => setError(result.ok ? "" : result.error));
                }}
              >
                Delete account
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </Screen>
  );
}

function ProfileLink() {
  return (
    <button type="button" className="mr-2 text-sm font-bold text-accent" onClick={() => navigate("/profile/")}>
      Profile
    </button>
  );
}

function slugify(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || `dish-${Date.now().toString(36)}`;
}
