"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function RappelForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({ firstName: "", phone: "", city: "", message: "" });
  // Honeypot
  const [company, setCompany] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company) return; // honeypot déclenché
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: "—",
          email: "rappel@sophiacademia.fr",
          phone: form.phone,
          city: form.city,
          message: form.message || `Demande de rappel de ${form.firstName} — ${form.city}`,
          company, // honeypot
        }),
      });
      if (res.ok) {
        setStatus("success");
        setForm({ firstName: "", phone: "", city: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const cities = [
    "Sophia Antipolis", "Antibes", "Valbonne", "Biot", "Grasse",
    "Villeneuve-Loubet", "Cagnes-sur-Mer", "Nice", "Juan-les-Pins", "Cannes", "Le Cannet",
  ];

  const inputClass =
    "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-amber-400 transition";

  if (status === "success") {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(5,150,105,0.15)", border: "1px solid rgba(5,150,105,0.4)" }}>
        <p className="text-3xl mb-3">✅</p>
        <p className="text-lg font-semibold text-white mb-1">Votre demande est envoyée !</p>
        <p className="text-sm text-white/70">Un conseiller vous rappelle sous 2h en semaine.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Honeypot invisible */}
      <div aria-hidden className="absolute -left-[9999px]">
        <input
          tabIndex={-1}
          name="company"
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/70" htmlFor="rappel-firstName">
            Prénom *
          </label>
          <input
            id="rappel-firstName"
            name="firstName"
            type="text"
            required
            placeholder="Emma"
            value={form.firstName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/70" htmlFor="rappel-phone">
            Téléphone *
          </label>
          <input
            id="rappel-phone"
            name="phone"
            type="tel"
            required
            placeholder="06 XX XX XX XX"
            value={form.phone}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/70" htmlFor="rappel-city">
          Votre ville
        </label>
        <select
          id="rappel-city"
          name="city"
          value={form.city}
          onChange={handleChange}
          className={inputClass}
          style={{ WebkitAppearance: "none" }}
        >
          <option value="" style={{ backgroundColor: "#1E3A5F" }}>Sélectionnez votre ville…</option>
          {cities.map((c) => (
            <option key={c} value={c} style={{ backgroundColor: "#1E3A5F" }}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/70" htmlFor="rappel-message">
          Besoin (optionnel)
        </label>
        <textarea
          id="rappel-message"
          name="message"
          rows={3}
          placeholder="Ex : mon fils est en 3e, il a du mal en maths…"
          value={form.message}
          onChange={handleChange}
          className={inputClass}
          style={{ resize: "none" }}
        />
      </div>

      {status === "error" && (
        <p className="rounded-xl bg-red-900/30 px-4 py-2.5 text-sm text-red-300">
          Une erreur s&apos;est produite. Réessayez ou appelez-nous directement.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 w-full rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
      >
        {status === "loading" ? "Envoi en cours…" : "Je veux être rappelé →"}
      </button>

      <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        Rappel gratuit · Sous 2h en semaine · Sans engagement
      </p>
    </form>
  );
}
