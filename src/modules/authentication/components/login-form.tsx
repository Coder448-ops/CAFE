"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { Button } from "@/shared/components/ui/button";
import { Field, Input } from "@/shared/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ redirectTo: string }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.replace(result.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ism@lolacafe.uz"
          className="h-12"
        />
      </Field>
      <Field label="Parol" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="h-12"
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={loading}>
        Kirish
      </Button>
      <p className="text-center text-xs text-coffee-400">
        Parolni unutdingizmi? Administratorga murojaat qiling.
      </p>
    </form>
  );
}
