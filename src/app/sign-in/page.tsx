import { AuthForm } from "@/components/AuthForm";
export default function SignIn() { return <main className="auth-shell"><AuthForm mode="sign-in" googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} /></main>; }
