import type { RazorpayCheckoutOptions, RazorpayCheckoutResult } from "@/lib/types";

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment cancelled.");
    this.name = "PaymentCancelledError";
  }
}

type RazorpayErrorPayload = {
  code?: number | string;
  description?: string;
  error?: { description?: string; reason?: string };
};

type RazorpayInstance = {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as RazorpayErrorPayload;
  } catch {
    return null;
  }
}

function describeError(payload: RazorpayErrorPayload | null) {
  if (!payload) return null;
  const description = payload.error?.description ?? payload.description ?? payload.error?.reason;
  if (description) return description;
  if (String(payload.code) === "2") return "Payment cancelled.";
  return null;
}

function checkoutError(error: unknown): Error {
  const candidates: unknown[] = [];
  if (typeof error === "string") {
    candidates.push(error);
  } else if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown; errorMessage?: unknown };
    candidates.push(record.message, record.errorMessage, record.code);
  }

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const description = describeError(parseJson(candidate)) ?? describeError({ description: candidate });
    if (!description) continue;
    if (/cancel/i.test(description) || /^2:/.test(candidate) || /cancel/i.test(candidate)) {
      return new PaymentCancelledError();
    }
    return new Error(description);
  }

  return new Error("Payment was not completed. Try again when you are ready.");
}

function parseResult(payload: unknown): RazorpayCheckoutResult {
  let value = payload;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error("Razorpay returned an unreadable payment receipt.");
    }
  }
  const result = value as Partial<RazorpayCheckoutResult> | null;
  if (!result?.razorpay_payment_id || !result.razorpay_order_id || !result.razorpay_signature) {
    throw new Error(
      "Razorpay did not return a payment receipt. If money was deducted, the order will update automatically.",
    );
  }
  return {
    razorpay_payment_id: result.razorpay_payment_id,
    razorpay_order_id: result.razorpay_order_id,
    razorpay_signature: result.razorpay_signature,
  };
}

async function loadRazorpayCheckout() {
  if (window.Razorpay) return window.Razorpay;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay Checkout.")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
  if (!window.Razorpay) throw new Error("Could not load Razorpay Checkout.");
  return window.Razorpay;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<RazorpayCheckoutResult> {
  const { Capacitor } = await import("@capacitor/core");

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Checkout")) {
    try {
      const { Checkout } = await import("capacitor-razorpay");
      const result = await Checkout.open({
        ...options,
        amount: String(options.amount),
      } as { key: string; amount: string });
      return parseResult(result.response);
    } catch (error) {
      if (error instanceof PaymentCancelledError) throw error;
      throw checkoutError(error);
    }
  }

  const Razorpay = await loadRazorpayCheckout();
  return new Promise<RazorpayCheckoutResult>((resolve, reject) => {
    let failure: Error | null = null;
    const checkout = new Razorpay({
      ...options,
      handler: (response: RazorpayCheckoutResult) => {
        try {
          resolve(parseResult(response));
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        confirm_close: true,
        ondismiss: () => reject(failure ?? new PaymentCancelledError()),
      },
    });
    checkout.on("payment.failed", (response) => {
      failure = new Error(response?.error?.description || "The payment failed. You can try again.");
    });
    checkout.open();
  });
}
