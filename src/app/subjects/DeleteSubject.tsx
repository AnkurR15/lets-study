"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteSubject } from "./actions";
export function DeleteSubject({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  function confirmDelete() {
    toast(`Delete ${name}?`, {
      description: "The subject will be permanently deleted. Past sessions and study time remain, but will no longer show its name. Subject-specific goals will be deleted.",
      duration: 15000,
      action: { label: "Delete", onClick: () => startTransition(async () => {
        try {
          const data = new FormData(); data.set("id", id);
          const result = await deleteSubject(data);
          if (result === "active") toast.error("Stop or complete the active session before deleting this subject.");
          else if (result === "missing") toast.error("This subject no longer exists.");
          else toast.success("Subject deleted", { description: "Past study sessions have been kept." });
        } catch { toast.error("Could not delete the subject. Please try again."); }
      }) },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }
  return <button type="button" className="outline-button archive-button" disabled={pending} onClick={confirmDelete}>{pending ? "Deleting..." : "Delete subject"}</button>;
}
