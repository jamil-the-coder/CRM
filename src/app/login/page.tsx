import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="from-primary/10 via-background to-background flex flex-1 items-center justify-center bg-gradient-to-b px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl text-lg font-semibold">
            C
          </span>
          <span className="text-foreground text-lg font-semibold tracking-tight">
            CRM
          </span>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
