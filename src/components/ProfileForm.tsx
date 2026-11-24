"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

async function resizeImage(file: File): Promise<string> {
  if (! ["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.8);
  } finally { bitmap.close(); }
}

export function ProfileForm({ name, image }: { name: string; image: string | null }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [photo, setPhoto] = useState(image);
  const [imageError, setImageError] = useState(false);
  const [fileName, setFileName] = useState("");
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  async function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setProcessing(true);
    try { setPhoto(await resizeImage(file)); setFileName(file.name); setImageError(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not open this image."); }
    setProcessing(false);
    event.target.value = "";
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.updateUser({ name: String(data.get("name")).trim(), image: photo });
      if (result.error) setMessage(result.error.message ?? "Could not save your profile.");
      else { router.push("/dashboard"); router.refresh(); }
    } catch { setMessage("Could not connect. Please try again."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="form profile-form">
    <div className="profile-photo-row">
      <div className="profile-avatar">
        {photo && !imageError ? <img src={photo} alt="Profile preview" onError={() => setImageError(true)} /> : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>}
      </div>
      <div>
        <span className="profile-picture-label">Profile picture</span>
        <input className="profile-file-input" id="profile-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} disabled={pending || processing} />
        <label className="profile-file-button" htmlFor="profile-image">{photo ? "Change picture" : "Choose picture"}</label>
        {fileName && <p className="small" role="status">Selected: {fileName}</p>}
        <p className="muted small">JPEG, PNG or WebP, up to 5 MB. Save changes to apply.</p>
        {photo && <button type="button" className="text-button" onClick={() => { setPhoto(null); setFileName(""); setImageError(false); }}>Remove picture</button>}
      </div>
    </div>
    <label>Display name<input name="name" required maxLength={100} defaultValue={name} /></label>
    {message && <p role="status">{message}</p>}
    <button className="primary" disabled={pending || processing}>{pending ? "Saving..." : processing ? "Preparing image..." : "Save changes"}</button>
  </form>;
}
