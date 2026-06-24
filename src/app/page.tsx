import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          360° Virtuelle Touren
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
          Immersive Rundgänge für{" "}
          <span className="text-blue-400">jedes Objekt</span>
        </h1>

        <p className="text-slate-400 text-lg mb-8 max-w-lg mx-auto">
          Erstelle professionelle 360°-Touren für Immobilien, Hotels, Praxen und Unternehmen.
          Keine Software nötig – alles im Browser.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "text-base px-8")}>
            Kostenlos starten
          </Link>
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "text-base px-8 border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 bg-transparent"
            )}
          >
            Anmelden
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-4">
          {[
            { label: "360°-Panorama", desc: "Equirectangular & Standard" },
            { label: "Hotspots", desc: "Links, Info, Video & mehr" },
            { label: "Einbetten", desc: "iFrame für jede Website" },
          ].map((f) => (
            <div key={f.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white font-medium text-sm">{f.label}</p>
              <p className="text-slate-500 text-xs mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
