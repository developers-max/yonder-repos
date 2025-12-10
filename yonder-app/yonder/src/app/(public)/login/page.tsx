import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/app/_components/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-svh bg-gray-50 md:bg-[url('/home.avif')] md:bg-cover md:bg-center dark:brightness-[0.2] dark:grayscale">
      {/* Logo - static on mobile, fixed on desktop (behind form) */}
      <div className="flex justify-center pt-8 pb-4 md:fixed md:top-8 md:left-0 md:right-0 md:pt-0 md:pb-0 md:z-0">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <Image 
            src="/logo.svg" 
            alt="Yonder" 
            width={100} 
            height={100}
            className="w-20 h-20 md:w-[120px] md:h-[120px]"
          />
        </Link>
      </div>
      
      {/* Form container - optimized for mobile */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8 md:px-6 md:z-10">
        <div className="w-full max-w-sm bg-white p-5 sm:p-6 rounded-xl shadow-sm md:shadow-lg">
          <LoginForm />
        </div>
      </div>
      
    </div>
  );
}
