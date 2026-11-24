"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function SignOutButton() {
  const router = useRouter();
  return <button className="text-button" onClick={async () => { const result = await authClient.signOut(); if (!result.error) { router.push("/sign-in"); router.refresh(); } }}>Sign out</button>;
}
