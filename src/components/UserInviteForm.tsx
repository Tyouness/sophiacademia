"use client";

import { useMemo, useState } from "react";
import { LEVELS, SUBJECTS } from "@/lib/education/catalog";

type RoleOption = "admin" | "staff" | "family" | "professor";

type ToastState = { type: "success" | "error"; message: string } | null;

type ChildState = {
  firstName: string;
  lastName: string;
  level: string;
  subjects: string[];
};

type InviteFormProps = {
  actionUrl: string;
  allowedRoles: RoleOption[];
  title: string;
  description?: string;
};

const emptyChild = (): ChildState => ({
  firstName: "",
  lastName: "",
  level: "",
  subjects: [],
});

export default function UserInviteForm({
  actionUrl,
  allowedRoles,
  title,
  description,
}: InviteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [role, setRole] = useState<RoleOption>(allowedRoles[0] ?? "family");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [children, setChildren] = useState<ChildState[]>([emptyChild()]);
  const [freq, setFreq] = useState("weekly");
  const [periods, setPeriods] = useState<string[]>([]);
  const [duration, setDuration] = useState("1.5");
  const [profSubjects, setProfSubjects] = useState<string[]>([]);
  const [profMaxLevel, setProfMaxLevel] = useState("");
  const [profProfessionType, setProfProfessionType] = useState("student");
  const [profProfessionTitle, setProfProfessionTitle] = useState("");
  const [profSchoolName, setProfSchoolName] = useState("");
  const [profEmployerName, setProfEmployerName] = useState("");
  const [profJobTitle, setProfJobTitle] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("France");

  const isFamily = role === "family";
  const isProfessor = role === "professor";

  const subjectOptions = useMemo(() => SUBJECTS, []);
  const levelOptions = useMemo(() => LEVELS, []);

  function togglePeriod(value: string) {
    setPeriods((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }

  function toggleChildSubject(index: number, value: string) {
    setChildren((prev) => {
      const next = [...prev];
      const child = { ...next[index] };
      child.subjects = child.subjects.includes(value)
        ? child.subjects.filter((item) => item !== value)
        : [...child.subjects, value];
      next[index] = child;
      return next;
    });
  }

  function updateChild(index: number, patch: Partial<ChildState>) {
    setChildren((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addChild() {
    setChildren((prev) => [...prev, emptyChild()]);
  }

  function removeChild(index: number) {
    setChildren((prev) => prev.filter((_, idx) => idx !== index));
  }

  function toggleProfSubject(value: string) {
    setProfSubjects((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setToast(null);

    const payload: Record<string, unknown> = {
      role,
      firstName,
      lastName,
      email,
      phone,
      birthDate,
    };

    if (isFamily) {
      payload.family = {
        children,
        freq,
        periods,
        duration: Number(duration),
      };
    }

    if (isProfessor) {
      payload.professor = {
        subjects: profSubjects,
        maxLevel: profMaxLevel,
        professionType: profProfessionType,
        professionTitle: profProfessionTitle,
        schoolName: profProfessionType === "student" ? profSchoolName : "",
        employerName: profProfessionType === "employee" ? profEmployerName : "",
        jobTitle: profProfessionType === "employee" ? profJobTitle : "",
        birthDate,
        employmentStatus: profProfessionType,
      };
    }

    if (isFamily || isProfessor) {
      payload.address = {
        addr1,
        addr2,
        postcode,
        city,
        country,
      };
    }

    try {
      const response = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = data?.error ?? "internal_error";
        setToast({ type: "error", message: `Erreur: ${error}` });
        return;
      }

      setToast({ type: "success", message: "Invitation envoyee." });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setBirthDate("");
      setChildren([emptyChild()]);
      setFreq("weekly");
      setPeriods([]);
      setDuration("1.5");
      setProfSubjects([]);
      setProfMaxLevel("");
      setProfProfessionType("student");
      setProfProfessionTitle("");
      setProfSchoolName("");
      setProfEmployerName("");
      setProfJobTitle("");
      setAddr1("");
      setAddr2("");
      setPostcode("");
      setCity("");
      setCountry("France");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      setToast({ type: "error", message: `Erreur reseau: ${message}` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-md">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="firstName"
            placeholder="Prenom"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
          />
          <input
            name="lastName"
            placeholder="Nom"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="Telephone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
          />
          {(isFamily || isProfessor) && (
            <input
              name="birthDate"
              type="date"
              placeholder="Date de naissance"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
            />
          )}
          <select
            name="role"
            required
            value={role}
            onChange={(event) => setRole(event.target.value as RoleOption)}
            className="w-full rounded-full border border-blue-100 bg-white px-4 py-2 text-sm"
          >
            {allowedRoles.map((value) => (
              <option key={value} value={value}>
                {value === "admin"
                  ? "Admin"
                  : value === "staff"
                    ? "Staff"
                    : value === "family"
                      ? "Famille"
                      : "Professeur"}
              </option>
            ))}
          </select>
        </div>

        {(isFamily || isProfessor) && (
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Adresse
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="addr1"
                placeholder="Adresse"
                required
                value={addr1}
                onChange={(event) => setAddr1(event.target.value)}
                className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
              />
              <input
                name="addr2"
                placeholder="Complement"
                value={addr2}
                onChange={(event) => setAddr2(event.target.value)}
                className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
              />
              <input
                name="postcode"
                placeholder="Code postal"
                required
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
                className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
              />
              <input
                name="city"
                placeholder="Ville"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
              />
              <input
                name="country"
                placeholder="Pays"
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {isFamily && (
          <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Frequence</label>
                <select
                  value={freq}
                  onChange={(event) => setFreq(event.target.value)}
                  className="mt-1 w-full rounded-full border border-blue-100 bg-white px-4 py-2 text-sm"
                >
                  <option value="weekly">Chaque semaine</option>
                  <option value="biweekly">Chaque 2 semaines</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Duree (heures)</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  className="mt-1 w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Periodes</label>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {[
                    { value: "weekend", label: "Weekends" },
                    { value: "vacations", label: "Vacances" },
                  ].map((item) => (
                    <label key={item.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={periods.includes(item.value)}
                        onChange={() => togglePeriod(item.value)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {children.map((child, index) => (
                <div key={`child-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Enfant {index + 1}</p>
                    {children.length > 1 && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-500"
                        onClick={() => removeChild(index)}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <input
                      placeholder="Prenom"
                      value={child.firstName}
                      onChange={(event) => updateChild(index, { firstName: event.target.value })}
                      className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                    />
                    <input
                      placeholder="Nom"
                      value={child.lastName}
                      onChange={(event) => updateChild(index, { lastName: event.target.value })}
                      className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                    />
                    <select
                      value={child.level}
                      onChange={(event) => updateChild(index, { level: event.target.value })}
                      className="w-full rounded-full border border-blue-100 bg-white px-4 py-2 text-sm"
                    >
                      <option value="">Niveau</option>
                      {levelOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {subjectOptions.map((subject) => (
                      <label key={`${subject}-${index}`} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={child.subjects.includes(subject)}
                          onChange={() => toggleChildSubject(index, subject)}
                        />
                        {subject}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="rounded-full border border-blue-100 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-blue-600"
              onClick={addChild}
            >
              Ajouter un enfant
            </button>
          </div>
        )}

        {isProfessor && (
          <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">Statut</label>
                <select
                  value={profProfessionType}
                  onChange={(event) => setProfProfessionType(event.target.value)}
                  className="mt-1 w-full rounded-full border border-blue-100 bg-white px-4 py-2 text-sm"
                >
                  <option value="student">Etudiant</option>
                  <option value="employee">Salarie</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Profession</label>
                <input
                  value={profProfessionTitle}
                  onChange={(event) => setProfProfessionTitle(event.target.value)}
                  className="mt-1 w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                  placeholder="Profession"
                  required
                />
              </div>
            </div>

            {profProfessionType === "student" && (
              <div>
                <label className="text-xs font-semibold text-slate-600">Ecole</label>
                <input
                  value={profSchoolName}
                  onChange={(event) => setProfSchoolName(event.target.value)}
                  className="mt-1 w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                  placeholder="Nom de l'ecole"
                  required
                />
              </div>
            )}

            {profProfessionType === "employee" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Entreprise</label>
                  <input
                    value={profEmployerName}
                    onChange={(event) => setProfEmployerName(event.target.value)}
                    className="mt-1 w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                    placeholder="Entreprise"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Poste</label>
                  <input
                    value={profJobTitle}
                    onChange={(event) => setProfJobTitle(event.target.value)}
                    className="mt-1 w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                    placeholder="Poste"
                    required
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isProfessor && (
          <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-semibold text-slate-600">Matieres enseignables</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {subjectOptions.map((subject) => (
                  <label key={subject} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profSubjects.includes(subject)}
                      onChange={() => toggleProfSubject(subject)}
                    />
                    {subject}
                  </label>
                ))}
              </div>
            </div>
            <div className="max-w-xs">
              <label className="text-xs font-semibold text-slate-600">Niveau max</label>
              <select
                value={profMaxLevel}
                onChange={(event) => setProfMaxLevel(event.target.value)}
                className="mt-1 w-full rounded-full border border-blue-100 bg-white px-4 py-2 text-sm"
              >
                <option value="">Choisir</option>
                {levelOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Envoi..." : "Envoyer invitation"}
        </button>
      </form>

      {toast && (
        <div
          className={
            toast.type === "success"
              ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
