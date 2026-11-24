import { AuthForm } from "@/components/AuthForm";
export default function SignUp() { return <main className="auth-shell"><AuthForm mode="sign-up" googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} /></main>; }
