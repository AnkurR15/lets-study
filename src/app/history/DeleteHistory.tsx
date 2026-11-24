"use client";
import { toast } from "sonner";
import { removeHistory } from "./actions";
export function DeleteHistory({ id }: { id?: string }) {
  return <button type="button" className="outline-button" onClick={() => toast(id ? "Remove this session from history?" : "Clear all session history?", { description: "Study time remains in your goals and statistics. Active sessions are not affected.", duration: 10000, action: { label: "Remove", onClick: async () => { try { await removeHistory(id); toast.success("History updated"); } catch { toast.error("Could not update history."); } } }, cancel: { label: "Cancel", onClick: () => {} } })}>{id ? "Remove" : "Clear all history"}</button>;
}
