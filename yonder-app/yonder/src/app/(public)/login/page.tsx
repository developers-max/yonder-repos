import { LoginForm } from "@/app/_components/login-form";
import { PublicHeader } from "@/app/_components/public-header";

export default function LoginPage() {
  return (
    <div className="min-h-svh bg-background">
      <PublicHeader />
      
      <div className="flex items-center justify-center px-4 py-6 md:py-16">
        <div className="w-full max-w-sm bg-white p-5 sm:p-6 rounded-xl shadow-sm md:shadow-lg border">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
