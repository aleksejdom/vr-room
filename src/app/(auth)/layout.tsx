import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex flex-col items-center justify-center px-4 py-10">
      {/* Aurora backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <Link href="/" className="relative mb-8 text-white font-bold text-xl tracking-tight">
        VR-Rooms<span className="ml-1.5 text-sm font-normal text-slate-400">by Domowets</span>
      </Link>

      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
