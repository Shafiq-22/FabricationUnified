import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — BAF Job Book" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const notice =
    searchParams.reason === "inactive"
      ? "Your account is inactive or was signed out. Contact an administrator."
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 border-l-2 border-primary pl-4">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
            BAF
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Workshop Job Book
          </h1>
          <p className="text-xs text-muted-foreground">
            Steel Fabrication — internal access only
          </p>
        </div>
        <div className="border border-border bg-card p-6 shadow-sm">
          <LoginForm notice={notice} />
        </div>
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Authorised personnel only
        </p>
      </div>
    </main>
  );
}
