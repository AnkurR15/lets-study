import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
export default async function Settings() {
  const { user } = await requireSession();
  return <main className="workspace"><nav className="topbar"><Link className="brand" href="/dashboard">? let&apos;s study</Link><div><Link href="/dashboard">Dashboard</Link><SignOutButton /></div></nav><section className="content"><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile settings</h1><p className="muted">A few details about you.</p><div className="panel"><p className="small muted">Signed in as {user.email}</p><ProfileForm name={user.name} image={user.image ?? null} /></div></section></main>;
}
