"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { Button } from "@/shared/components/ui/button";
import { Field, Input } from "@/shared/components/ui/field";

export function PairForm() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ redirectTo: string }>("/api/table/pair", {
        method: "POST",
        body: { code },
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
      <Field label="Ulanish kodi" htmlFor="code" hint="Masalan: K7PM-92XQ">
        <Input
          id="code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          className="h-14 text-center font-mono text-xl tracking-[0.35em]"
        />
      </Field>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" fullWidth loading={loading}>
        Ulash
      </Button>
    </form>
  );
}
