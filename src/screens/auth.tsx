"use client";

import { useEffect, useState } from "react";
import { Button, ErrorNote, Field, Screen } from "@/components/ui";
import { homeFor, navigate, replace } from "@/lib/paths";
import { useStore } from "@/lib/store";

export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col justify-end bg-house px-6 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+4.5rem)] text-white">
      <p className="text-sm font-bold tracking-[0.18em] text-gold">CAMPUS CANTEEN</p>
      <h1 className="mt-3 text-5xl font-extrabold tracking-tight">CampusBite</h1>
    </div>
  );
}

export function SplashScreen() {
  const { ready, user } = useStore();

  useEffect(() => {
    if (!ready || !user) return;
    replace(homeFor(user.role));
  }, [ready, user]);

  return (
    <div className="flex min-h-dvh flex-col bg-house px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-white">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="grid h-24 w-24 place-items-center rounded-[28px] bg-accent shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <span className="text-4xl font-extrabold tracking-tight">CB</span>
        </div>
        <p className="mt-8 text-sm font-bold tracking-[0.18em] text-white/70">CAMPUS CANTEEN</p>
        <h1 className="mt-3 text-[2.5rem] font-extrabold leading-none tracking-tight">CampusBite</h1>
        <p className="mt-4 max-w-[16rem] text-lg leading-7 text-white/75">Order ahead. Skip the queue.</p>
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate("/login/")}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white text-base font-semibold text-green active:scale-95"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => navigate("/register/")}
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/50 bg-transparent text-base font-semibold text-white active:scale-95"
        >
          Sign up
        </button>
        <p className="pt-2 text-center text-sm text-white/60">20% now · 80% when it is ready</p>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const { login, user, problem } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) replace(homeFor(user.role));
  }, [user]);

  return (
    <Screen title="Sign in" eyebrow="CampusBite" backHref="/">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          void login(email, password).then((result) => {
            setPending(false);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {problem ? <ErrorNote>{problem}</ErrorNote> : null}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm font-semibold">
        <button type="button" className="text-accent" onClick={() => navigate("/forgot-password/")}>
          Forgot password
        </button>
        <button type="button" className="text-accent" onClick={() => navigate("/register/")}>
          Create student account
        </button>
      </div>
    </Screen>
  );
}

export function RegisterScreen() {
  const { register, user } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) replace(homeFor(user.role));
  }, [user]);

  return (
    <Screen title="Student account" backHref="/">
      <p className="mb-4 text-sm leading-6 text-muted">
        Sign up is for students. Kitchen, pickup, and admin use the sign-in screen with an account that already exists.
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void register(name, email, password).then((result) => {
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" className="w-full">
          Create student account
        </Button>
      </form>
    </Screen>
  );
}

export function ForgotScreen() {
  return (
    <Screen title="Reset password" backHref="/login/">
      <p className="text-sm leading-6 text-muted">
        Email reset is not connected yet. Ask a canteen administrator if you cannot sign in.
      </p>
    </Screen>
  );
}

export function UnauthorizedScreen() {
  const { user } = useStore();
  return (
    <Screen title="Not available">
      <p className="text-sm leading-6 text-muted">This area belongs to another role.</p>
      <Button className="mt-6 w-full" onClick={() => replace(user ? homeFor(user.role) : "/login/")}>
        Go to your home
      </Button>
    </Screen>
  );
}

export function NotFoundScreen() {
  const { user } = useStore();
  return (
    <Screen title="Page missing">
      <p className="text-sm leading-6 text-muted">That screen is not part of CampusBite.</p>
      <Button className="mt-6 w-full" onClick={() => replace(user ? homeFor(user.role) : "/login/")}>
        Back home
      </Button>
    </Screen>
  );
}
