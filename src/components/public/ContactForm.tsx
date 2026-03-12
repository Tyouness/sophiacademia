"use client";

import { useState } from "react";

type Toast = { type: "success" | "error"; message: string } | null;

export default function ContactForm() {
  const [toast, setToast] = useState<Toast>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);
    setIsSending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      city: String(formData.get("city") ?? ""),
      message: String(formData.get("message") ?? ""),
      company: String(formData.get("company") ?? ""),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setToast({ type: "error", message: data?.error ?? "Envoi impossible." });
        return;
      }

      form.reset();
      setToast({ type: "success", message: "Message envoyé. Nous revenons vers vous rapidement." });
    } catch {
      setToast({ type: "error", message: "Erreur réseau. Merci de réessayer." });
    } finally {
      setIsSending(false);
    }
  }

  const inputClass = "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-amber-400";
  const inputStyle = { borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", color: "#0F172A" };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl p-8"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <input name="firstName" required placeholder="Prénom *" className={inputClass} style={inputStyle} />
        <input name="lastName" required placeholder="Nom *" className={inputClass} style={inputStyle} />
        <input name="email" required type="email" placeholder="Email *" className={inputClass} style={inputStyle} />
        <input name="phone" placeholder="Téléphone (optionnel)" className={inputClass} style={inputStyle} />
      </div>
      <input name="city" placeholder="Ville (ex : Antibes, Valbonne, Nice…)" className={inputClass} style={inputStyle} />
      <textarea
        name="message"
        required
        rows={5}
        placeholder="Décrivez votre besoin : niveau scolaire, matière, objectifs, fréquence souhaitée…"
        className={inputClass}
        style={inputStyle}
      />
      {/* Honeypot anti-spam */}
      <div className="hidden" aria-hidden>
        <label htmlFor="company">Entreprise</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <button
        type="submit"
        disabled={isSending}
        className="rounded-full px-7 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
      >
        {isSending ? "Envoi en cours…" : "Envoyer ma demande"}
      </button>
      {toast && (
        <p
          className="text-sm font-medium"
          style={{ color: toast.type === "success" ? "#059669" : "#DC2626" }}
        >
          {toast.message}
        </p>
      )}
    </form>
  );
}
