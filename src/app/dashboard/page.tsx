import Link from "next/link";
import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/components/SignOutButton";
export default async function Dashboard() {
  const { user } = await requireSession();
  return <main className="workspace"><nav className="topbar"><Link className="brand" href="/">? let&apos;s study</Link><div><Link href="/settings">Profile</Link><SignOutButton /></div></nav><section className="content"><p className="eyebrow">YOUR STUDY SPACE</p><h1>Welcome, {user.name}.</h1><p className="muted">A little progress, every day. Your study space is taking shape.</p><div className="notice"><span>?</span><div><h2>Ready to grow?</h2><p>Focus sessions and your garden are coming in the next phases.</p><Link href="/settings">View your profile ?</Link></div></div></section></main>;
}
