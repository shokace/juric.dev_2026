import { LoginPanel } from "./LoginPanel";

export const metadata = {
  title: "Admin | Juric",
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const authenticated = false;

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 sm:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="space-y-2 text-white">
          <div className="text-sm uppercase tracking-[0.2em] text-white/50">Admin</div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Secure access</h1>
          <p className="text-white/70">
            Sign in to manage your location. Your session is stored in an httpOnly cookie and never leaves this browser.
          </p>
        </div>

        <LoginPanel initialAuthenticated={authenticated} />
      </div>
    </main>
  );
}
