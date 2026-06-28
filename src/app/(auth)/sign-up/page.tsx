"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useState } from "react";
import { registerUser } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await registerUser(new FormData(e.currentTarget));
      if (result?.error) setError(result.error);
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Konto erstellen</CardTitle>
          <CardDescription>Starte kostenlos mit VR Rooms</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                autoComplete="name"
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@beispiel.de"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Mindestens 6 Zeichen"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kostenlos registrieren
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Bereits registriert?{" "}
              <Link href="/sign-in" className="text-primary hover:underline font-medium">
                Anmelden
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
