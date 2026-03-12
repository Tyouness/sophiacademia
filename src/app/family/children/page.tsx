"use client";

import { useEffect, useState } from "react";
import { LEVELS, SUBJECTS } from "@/lib/education/catalog";

type ToastState = { type: "success" | "error"; message: string } | null;

type ChildRow = {
  id: string;
  family_id: string;
  first_name: string | null;
  last_name: string | null;
  level: string | null;
  subjects: string[];
  created_at: string;
};

type ChildForm = {
  firstName: string;
  lastName: string;
  level: string;
  subjects: string[];
};

const emptyForm: ChildForm = {
  firstName: "",
  lastName: "",
  level: "",
  subjects: [],
};

export default function FamilyChildrenPage() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<ChildForm>(emptyForm);
  const [addSaving, setAddSaving] = useState(false);

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ChildForm>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/family/children");
      if (!response.ok) {
        throw new Error("Failed to load");
      }
      const data = await response.json();
      setChildren(data.data ?? []);
    } catch {
      setToast({ type: "error", message: "Erreur lors du chargement des enfants." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4000);
  }

  async function handleAdd() {
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) {
      showToast("error", "Prénom et nom sont obligatoires.");
      return;
    }
    setAddSaving(true);
    try {
      const response = await fetch("/api/family/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName: addForm.lastName.trim(),
          level: addForm.level || undefined,
          subjects: addForm.subjects,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Erreur");
      }
      setIsAdding(false);
      setAddForm(emptyForm);
      showToast("success", "Enfant ajouté avec succès.");
      await load();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(child: ChildRow) {
    setEditingId(child.id);
    setEditForm({
      firstName: child.first_name ?? "",
      lastName: child.last_name ?? "",
      level: child.level ?? "",
      subjects: Array.isArray(child.subjects) ? child.subjects : [],
    });
  }

  async function handleEdit() {
    if (!editingId) {
      return;
    }
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      showToast("error", "Prénom et nom sont obligatoires.");
      return;
    }
    setEditSaving(true);
    try {
      const response = await fetch("/api/family/children", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: editingId,
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          level: editForm.level || undefined,
          subjects: editForm.subjects,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Erreur");
      }
      setEditingId(null);
      showToast("success", "Enfant mis à jour.");
      await load();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setEditSaving(false);
    }
  }

  function toggleSubject(form: ChildForm, setForm: (f: ChildForm) => void, subject: string) {
    const current = form.subjects;
    if (current.includes(subject)) {
      setForm({ ...form, subjects: current.filter((s) => s !== subject) });
    } else {
      setForm({ ...form, subjects: [...current, subject] });
    }
  }

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Mes enfants</h2>
            <p className="mt-1 text-sm text-gray-500">
              Gérez les profils de vos enfants et leurs besoins pédagogiques.
            </p>
          </div>
          {!isAdding && (
            <button
              type="button"
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
              onClick={() => {
                setIsAdding(true);
                setAddForm(emptyForm);
              }}
            >
              Ajouter un enfant
            </button>
          )}
        </div>

        {isAdding && (
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-6">
            <h3 className="text-sm font-semibold text-gray-900">Nouvel enfant</h3>
            <ChildFormFields
              form={addForm}
              onChange={setAddForm}
              onToggleSubject={(s) => toggleSubject(addForm, setAddForm, s)}
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
                onClick={handleAdd}
                disabled={addSaving}
              >
                {addSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button
                type="button"
                className="rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-600"
                onClick={() => setIsAdding(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className={
            toast.type === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          }
        >
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-600">
          Chargement...
        </div>
      ) : children.length === 0 ? (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <p className="text-sm text-gray-500">
            Aucun enfant enregistré. Cliquez sur "Ajouter un enfant" pour commencer.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) => (
            <div key={child.id} className="rounded-xl bg-white p-6 shadow-md">
              {editingId === child.id ? (
                <>
                  <h3 className="mb-4 text-sm font-semibold text-gray-900">
                    Modifier — {child.first_name} {child.last_name}
                  </h3>
                  <ChildFormFields
                    form={editForm}
                    onChange={setEditForm}
                    onToggleSubject={(s) => toggleSubject(editForm, setEditForm, s)}
                  />
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
                      onClick={handleEdit}
                      disabled={editSaving}
                    >
                      {editSaving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-600"
                      onClick={() => setEditingId(null)}
                    >
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {child.first_name ?? ""} {child.last_name ?? ""}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Niveau : {child.level ?? "Non renseigné"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Matières :{" "}
                      {Array.isArray(child.subjects) && child.subjects.length > 0
                        ? child.subjects.join(", ")
                        : "Aucune"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                    onClick={() => startEdit(child)}
                  >
                    Modifier
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Shared form fields component
// ---------------------------------------------------------------------------

function ChildFormFields({
  form,
  onChange,
  onToggleSubject,
}: {
  form: ChildForm;
  onChange: (f: ChildForm) => void;
  onToggleSubject: (subject: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
        Prénom *
        <input
          type="text"
          value={form.firstName}
          onChange={(e) => onChange({ ...form, firstName: e.target.value })}
          className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm font-normal"
          placeholder="Emma"
        />
      </label>

      <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
        Nom *
        <input
          type="text"
          value={form.lastName}
          onChange={(e) => onChange({ ...form, lastName: e.target.value })}
          className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm font-normal"
          placeholder="Dupont"
        />
      </label>

      <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
        Niveau scolaire
        <select
          value={form.level}
          onChange={(e) => onChange({ ...form, level: e.target.value })}
          className="mt-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-normal"
        >
          <option value="">— Choisir un niveau —</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 sm:col-span-2">
        Matières souhaitées
        <div className="mt-2 flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onToggleSubject(s)}
              className={
                form.subjects.includes(s)
                  ? "rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
