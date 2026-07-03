import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 flex items-center justify-center px-4">
      {/* Aurora backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-48 left-1/3 h-[30rem] w-[30rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,6,23,0.6))]" />
      </div>

      <div className="relative text-center max-w-2xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-dark text-blue-300 text-sm mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          VR-Rooms by Domowets
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold text-white mb-5 leading-tight tracking-tight">
          Immersive Rundgänge für{" "}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            jedes Objekt
          </span>
        </h1>

        <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto">
          Erstelle professionelle 360°-Touren für Immobilien, Hotels, Praxen und Unternehmen.
          Keine Software nötig – alles im Browser.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ size: "lg" }),
              "text-base px-8 bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25"
            )}
          >
            Kostenlos starten
          </Link>
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "text-base px-8 glass-dark text-slate-200 hover:text-white hover:bg-white/10"
            )}
          >
            Anmelden
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "360°-Panorama", desc: "Equirectangular & Standard" },
            { label: "Hotspots", desc: "Links, Info, Video & mehr" },
            { label: "Einbetten", desc: "iFrame für jede Website" },
          ].map((f) => (
            <div
              key={f.label}
              className="p-5 rounded-2xl glass-dark transition-transform duration-300 hover:-translate-y-1"
            >
              <p className="text-white font-semibold text-sm">{f.label}</p>
              <p className="text-slate-400 text-xs mt-1.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
