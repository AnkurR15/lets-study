"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function ProfileForm({ name, image }: { name: string; image: string | null }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.updateUser({ name: String(data.get("name")).trim(), image: String(data.get("image")).trim() || null });
      if (result.error) setMessage(result.error.message ?? "Could not save your profile.");
      else { setMessage("Profile saved."); router.refresh(); }
    } catch { setMessage("Could not connect. Please try again."); } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="form profile-form">
    <label>Display name<input name="name" required maxLength={100} defaultValue={name} /></label>
    <label>Profile image URL<input name="image" type="url" defaultValue={image ?? ""} placeholder="https://example.com/photo.jpg" /></label>
    <p className="muted small">Use a public HTTPS image URL. Image upload will be added later.</p>
    {message && <p role="status">{message}</p>}
    <button className="primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
  </form>;
}
