"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "sign-in" | "sign-up";
  googleEnabled: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              name: String(form.get("name")).trim(),
              email,
              password,
            })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(
          result.error.message ?? "Unable to authenticate. Please try again.",
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }
  async function google() {
    setError("");
    setPending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
      if (result.error)
        setError(result.error.message ?? "Google sign-in failed.");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-card">
      <Link href="/" className="brand">
        ? let&apos;s study
      </Link>
      <p className="eyebrow">A LITTLE SPACE TO GROW</p>
      <h1>{mode === "sign-up" ? "Start something good." : "Welcome back."}</h1>
      <p className="muted">
        {mode === "sign-up"
          ? "Create an account and make room for focused days."
          : "Pick up where you left off, one session at a time."}
      </p>
      {googleEnabled && (
        <>
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={google}
          >
            Continue with Google
          </button>
          <div className="divider">or continue with email</div>
        </>
      )}
      <form onSubmit={submit} className="form">
        {mode === "sign-up" && (
          <label>
            Name
            <input
              name="name"
              required
              maxLength={100}
              autoComplete="name"
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
            placeholder="At least 8 characters"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "sign-up"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>
      <p className="footnote">
        {mode === "sign-up" ? "Already have an account? " : "New here? "}
        <Link href={mode === "sign-up" ? "/sign-in" : "/sign-up"}>
          {mode === "sign-up" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
