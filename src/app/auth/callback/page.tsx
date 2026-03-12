"use client";

import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Validation en cours...");

  useEffect(() => {
    const url = new URL(window.location.href);
    const nextPath = url.searchParams.get("next") ?? "";
    const code = url.searchParams.get("code");

    if (code) {
      const redirectUrl = new URL("/auth/callback/complete", url.origin);
      redirectUrl.searchParams.set("code", code);
      if (nextPath) {
        redirectUrl.searchParams.set("next", nextPath);
      }
      window.location.replace(redirectUrl.toString());
      return;
    }

    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const error = hashParams.get("error");

    if (error) {
      window.location.replace("/login?error=Lien%20invalide%20ou%20expire");
      return;
    }

    if (!accessToken || !refreshToken) {
      window.location.replace("/login?error=Session%20manquante");
      return;
    }

    fetch("/auth/callback/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        refreshToken,
        next: nextPath || null,
      }),
    })
      .then((response) => {
        if (response.redirected) {
          window.location.assign(response.url);
          return null;
        }
        return response.json();
      })
      .then((data) => {
        if (data?.redirectTo) {
          window.location.assign(data.redirectTo);
          return;
        }
        setMessage("Impossible de valider la session.");
      })
      .catch(() => {
        setMessage("Impossible de valider la session.");
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
      <p className="text-sm text-zinc-600">{message}</p>
    </main>
  );
}
