# Audit Architecture Métier — Sophiacademia
> Date : 6 mars 2026  
> Rôle : Architecte technique  
> Objectif : Verrouiller le modèle de données avant toute nouvelle implémentation

---

## A — Modèle actuel réel

### Inventaire complet des tables (dans l'ordre des migrations)

---

#### `profiles`
Table centrale unifiée pour tous les rôles.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | = auth.users.id |
| `role` | text | enum: admin / staff / family / professor |
| `username` | text | unique |
| `full_name` | text | |
| `email` | text | |
| `phone` | text | |
| `addr1`, `addr2`, `postcode`, `city`, `country` | text | adresse principale |
| `lat`, `lng` | numeric | géocodés |
| `address_hash`, `geocoded_at` | | invalidation cache géocode |
| `birth_date` | date | ajouté en 0012 |
| `disabled_at`, `deleted_at`, `deleted_by` | timestamp/uuid | soft delete |
| `created_at`, `updated_at` | timestamp | |

**Rôle réel :** Identité + coordonnées physiques de TOUS les utilisateurs du système.

---

#### `family_profiles`
Données étendues famille — table satellite de `profiles`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK FK → profiles | |
| `rep_first`, `rep_last`, `rep_phone` | text | représentant légal |
| `student_first`, `student_last` | text | ⚠️ **données d'un seul enfant (legacy)** |
| `level` | text | ⚠️ **niveau d'un seul enfant (legacy)** |
| `subjects` | jsonb | ⚠️ **matières d'un seul enfant (legacy)** |
| `freq` | text | fréquence souhaitée |
| `duration` | numeric | durée session souhaitée |
| `start_date` | date | |
| `periods` | text[] | créneaux souhaités |
| `addr1`, `addr2`, `postcode`, `city`, `country` | text | adresse (dupliquée aussi dans profiles) |
| `lat`, `lng` | numeric | (dupliqués aussi dans profiles) |
| `fiscal_consent`, `mandate_consent`, `legal_notice_accepted` | boolean | consentements URSSAF |
| `urssaf_consent_at` | timestamp | |
| `created_at`, `updated_at` | timestamp | |

**Rôle réel :** Profil pédagogique famille + consentements légaux. Contient des champs mono-enfant legacy (`student_first`, `level`, `subjects`) qui coexistent avec la table `family_children`.

---

#### `professor_profiles`
Données étendues professeur — table satellite de `profiles`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK FK → profiles | |
| `skills` | jsonb | array de `{subject, max_level}` |
| `car_hp` | integer | CV fiscal pour calcul IK |
| `nir` | text | numéro sécurité sociale |
| `address`, `city`, `postcode` | text | (legacy — dupliqués dans profiles) |
| `addr1`, `addr2`, `country` | text | |
| `lat`, `lng` | numeric | géolocalisation prof |
| `birth_date` | date | |
| `employment_status` | text | student / employee / self_employed / other |
| `created_at`, `updated_at` | timestamp | |

**Rôle réel :** Compétences, localisation et paramètres de paie du professeur.

---

#### `family_children`
Table des enfants (ajoutée en migration 0005).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `family_id` | uuid FK → profiles | |
| `first_name`, `last_name` | text | |
| `level` | text | classe/niveau |
| `subjects` | jsonb | matières souhaitées |
| `created_at` | timestamp | |

**Rôle réel :** Stocker les enfants d'une famille avec leurs besoins pédagogiques.  
**Usage réel :** Alimentée lors de l'invitation famille (`UserInviteForm`). Lue UNIQUEMENT dans `/api/professor/offers` pour afficher les enfants sur la carte. **Non référencée dans `requests` ni dans `courses`.**

---

#### `requests`
Table centrale de la relation prof/famille.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `professor_id` | uuid FK → profiles | |
| `family_id` | uuid FK → profiles | |
| `subject` | text | matière |
| `status` | text | pending / coords_sent / approved / rejected / ended / detached |
| `rejected_at`, `ended_at` | timestamp | |
| `end_reason` | text | raison de fin (stockée mais pas affichée dans l'UI) |
| `first_course_at` | timestamp | |
| `weekly_sessions` | integer | 1–7 |
| `session_hours` | numeric | 0.5–6 |
| `weekly_schedule` | jsonb | array de datetime ISO (planning hebdo) |
| `created_at`, `updated_at` | timestamp | |

**Index unique :** `(professor_id, family_id, subject, status)` WHERE status IN ('pending', 'coords_sent', 'approved')  
**Rôle réel :** Contient en même temps la CANDIDATURE (pending), l'ASSIGNMENT (approved) et le PLANNING (weekly_schedule). Ces 3 concepts distincts sont fusionnés dans une seule table.

---

#### `courses`
Table des cours déclarés (post-réalisation uniquement).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `professor_id` | uuid FK → profiles | |
| `family_id` | uuid FK → profiles | |
| `hours` | numeric | |
| `courses_count` | integer | nb de séances |
| `subject` | text | |
| `course_date` | timestamp | date de réalisation |
| `status` | text | pending / paid / advance / paid_by_urssaf |
| `approval_status` | text | family_pending / family_confirmed / family_update_requested / staff_canceled |
| `paid_at` | timestamp | |
| `family_confirmed_at`, `family_update_requested_at`, `family_response_deadline` | timestamp | |
| `family_update_note` | text | note de contestation famille |
| `staff_canceled_at`, `staff_canceled_by` | timestamp/uuid | |
| `staff_correction_note`, `staff_corrected_at`, `staff_corrected_by` | | |
| `distance_km`, `distance_km_one_way`, `distance_km_round_trip` | numeric | IK distance |
| `duration_minutes` | numeric | |
| `distance_source`, `distance_fetched_at` | | traçabilité calcul distance |
| `prof_hourly`, `prof_total`, `prof_net`, `indemn_km`, `ik_amount` | numeric | snapshot paie |
| `ik_rate_version`, `pricing_policy_version`, `rate_set_version`, `rounding_policy_version` | text | versionnage des paramètres de calcul |
| `course_month` | text | YYYY-MM pour regroupement mensuel |
| `created_at`, `updated_at` | timestamp | |

**Rôle réel :** Cours réalisé (jamais futur). Snapshot de paie au moment de la déclaration. Dual-statut : `status` (paiement prof) + `approval_status` (validation famille).

---

#### `invoices`
Factures émises aux familles.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `family_id` | uuid FK → profiles | |
| `period` | text | ex: "2026-02" |
| `number` | text | unique, numérotation légale |
| `total` | numeric | |
| `total_ttc` | numeric | |
| `hours` | numeric | |
| `issue_date`, `period_start`, `period_end` | timestamp | |
| `status` | text | draft / issued / paid / cancelled |
| `pdf_url` | text | |
| `created_at` | timestamp | |

**Rôle réel :** Facture mensuelle par famille. Alimentée via `invoice_lines`.

---

#### `invoice_lines`
Lignes de détail d'une facture.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `invoice_id` | uuid FK → invoices | |
| `course_id` | uuid FK → courses (unique) | **un cours ne peut appartenir qu'à une seule facture** |
| `description` | text | |
| `quantity`, `unit_price`, `total` | numeric | |
| `created_at` | timestamp | |

---

#### `payslips`
Bulletins de paie des professeurs.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `professor_id` | uuid FK → profiles | |
| `family_id` | uuid FK → profiles (nullable) | ⚠️ **liaison mono-famille legacy** |
| `period` | text | YYYY-MM |
| `number` | text | unique |
| `period_start`, `period_end` | timestamp | |
| `total_net`, `total_indemn_km` | numeric | |
| `gross_salary_total`, `net_salary_total`, `reimbursements_total`, `employer_contribs_total` | numeric | |
| `status` | text | pending / paid |
| `course_ids` | jsonb | array des cours inclus |
| `rate_set_version`, `pricing_policy_version`, `rounding_policy_version` | text | versionnage |
| `calculation_hash` | text | empreinte du calcul |
| `pdf_url`, `pdf_path` | text | |
| `created_at`, `updated_at` | timestamp | |

**Index unique :** `(professor_id, period)` — un bulletin par prof par période  
**Rôle réel :** Bulletin mensuel du prof agrégant TOUS ses cours du mois, toutes familles confondues. Le `family_id` est un héritage devenu obsolète (maintenant nullable).

---

#### `payslip_lines`
Lignes de détail d'un bulletin.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `payslip_id` | uuid FK → payslips | |
| `course_id` | uuid FK → courses | |
| `hours` | numeric | |
| `net_amount`, `indemn_km` | numeric | |
| `created_at` | timestamp | |

---

#### `audit_logs`
Trail des actions admin.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `actor_id` | uuid | UUID (non résolu en nom) |
| `action` | text | |
| `entity`, `entity_id` | text/uuid | |
| `payload` | jsonb | |
| `target_user_id` | uuid | |
| `role_set` | text | |
| `metadata` | jsonb | |
| `created_at` | timestamp | |

---

#### Tables URSSAF (circuit parallèle, sans UI)

| Table | Rôle |
|---|---|
| `urssaf_clients` | Dossier URSSAF par famille (fiscal_number, customer_id, status) |
| `course_invoices` | Invoice level course pour URSSAF (lié à course_id) |
| `urssaf_invoices` | Suivi paiement URSSAF (urssaf_payment_id, validated_at) |
| `monthly_statements` | Relevé mensuel famille (total_hours, total_amount, period) |

---

## B — Mapping avec le modèle cible

| Entité cible | Situation actuelle | État |
|---|---|---|
| **Family** | `profiles` (role=family) + `family_profiles` | ✅ Existe — en 2 tables |
| **Child** | `family_children` | ✅ Existe — mais orpheline du reste du workflow |
| **Request** (besoin pédagogique) | Partiellement dans `family_profiles` + `family_children` | ❌ Manque — confondue avec Application et Assignment |
| **Offer** (publication aux profs) | Aucune table — calculée dynamiquement à la volée | ❌ Manque — inexistante en base |
| **Application** (candidature prof) | Ligne `requests` avec `status=pending` | ⚠️ Fusionnée dans `requests` |
| **Assignment** (relation validée) | Ligne `requests` avec `status=approved` | ⚠️ Fusionnée dans `requests` |
| **PlannedSchedule** | Colonnes `weekly_sessions`, `session_hours`, `weekly_schedule` sur `requests` | ⚠️ Fusionnée dans `requests` |
| **Course** (cours réalisé) | `courses` | ✅ Existe — bien structuré |
| **Invoice** | `invoices` + `invoice_lines` | ✅ Existe — complet |
| **Payslip** | `payslips` + `payslip_lines` | ✅ Existe — complet |

### Fusions problématiques

La table `requests` contient actuellement **4 concepts distincts** :

```
requests.status = "pending"     → Application (candidature professeur)
requests.status = "coords_sent" → Application en attente validation staff
requests.status = "approved"    → Assignment (relation active validée)
requests.weekly_schedule        → PlannedSchedule (planning hebdo de l'assignment)
```

La mécanique de `Request` au sens métier (besoin pédagogique d'un enfant publié par le staff) **n'existe pas du tout** comme entité distincte. Le besoin pédagogique est dispersé dans `family_profiles` + `family_children`.

---

## C — Analyse enfants / familles

### La table `family_children` existe-t-elle ?

**Oui.** Migration 0005. Colonnes : `id`, `family_id`, `first_name`, `last_name`, `level`, `subjects`.

### Les demandes sont-elles liées à un enfant ?

**Non.** La table `requests` n'a pas de colonne `child_id`. Une request est identifiée par `(professor_id, family_id, subject)`. Aucun lien vers un enfant spécifique.

### Les cours sont-ils liés à un enfant ?

**Non.** La table `courses` n'a pas de colonne `child_id`. Un cours est identifié par `(professor_id, family_id, subject)`. Aucun lien vers un enfant spécifique.

### Les pages UI utilisent-elles `family_children` ?

**Uniquement dans un seul endroit :** `/api/professor/offers/route.ts` — pour afficher le nom, niveau et matières des enfants dans les cartes d'offres sur la carte Google Maps.

Nulle part ailleurs dans l'application (pas dans `/family/courses`, pas dans `/staff/courses`, pas dans le dashboard famille).

### Problème structurel exact

Il existe **deux modèles de données famille en contradiction** :

**Modèle A — Legacy mono-enfant (dans `family_profiles`) :**
```
family_profiles.student_first / student_last    → prénom/nom d'un seul enfant
family_profiles.level                            → niveau d'un seul enfant
family_profiles.subjects                         → matières d'un seul enfant
family_profiles.freq / duration / periods        → paramètres d'un seul besoin
```

**Modèle B — Multi-enfants (dans `family_children`) :**
```
family_children.first_name / last_name           → prénom/nom de l'enfant
family_children.level                            → niveau de l'enfant
family_children.subjects                         → matières souhaitées
```

Ces deux modèles coexistent. L'API `professor/offers` utilise le Modèle B (children) pour l'affichage des cartes, mais les champs de candidature (`subject`) transitent par le Modèle A (family_profiles level/subjects) pour le filtrage de compatibilité.

**Impact concret :** Une famille avec 2 enfants (math niveau 3ème + anglais niveau 2nde) ne peut pas avoir 2 demandes distinctes. Une candidature professeur crée une `request(professor_id, family_id, subject)` sans savoir pour quel enfant.

---

## D — Analyse requests / offers / candidatures

### Flux actuel complet

```
[staff invite famille]
  → family_profiles créé (level + subjects = legacy mono-enfant)
  → family_children créé(s) (multi-enfants: level + subjects par enfant)

[API GET /professor/offers]
  → lit family_profiles (lat/lng, freq, duration)
  → lit family_children (firstName, lastName, level, subjects)
  → calcule distance + rémunération estimée
  → retourne liste dynamique (aucune table "offer" intermédiaire)

[prof clique "Candidater"]
  → API POST /professor/requests
  → body: { familyId, subject }
  → INSERT INTO requests (professor_id, family_id, subject, status="pending")
  → index unique bloque les doublons (professor_id, family_id, subject) WHERE status IN (active)

[staff voit la demande dans /staff/requests]
  → status = "pending"

[staff clique "Envoyer coordonnées"]
  → API POST /staff/requests { action: "share_coords", requestId }
  → UPDATE requests SET status = "coords_sent"
  → sendEmail() aux deux parties

[staff clique "Approuver"]
  → API POST /staff/requests { action: "approve", requestId }
  → UPDATE requests SET status = "approved"

[staff clique "Dissocier"]
  → API POST /staff/requests { action: "detach", requestId }
  → UPDATE requests SET status = "detached"
```

### Ce que ça implique

1. **Une candidature = directement une `request`**. Il n'existe pas d'état intermédiaire "candidature visible par le staff avant décision". Dès que le prof candidate, la `request` avec `status=pending` est visible dans `/staff/requests`. Aucune distinction n'est faite entre "prof intéressé" (candidature) et "staff a sélectionné ce prof" (assignment).

2. **Une offre n'est pas persistée**. Si une famille est retirée du catalogue (disabled), toutes ses "offres" disparaissent sans trace. Il est impossible de savoir combien de professeurs ont vu ou ignoré une offre.

3. **Un prof ne peut pas avoir deux relations actives avec la même famille sur la même matière** (contrainte unique). Cela pose problème si une famille a deux enfants en mathématiques à des niveaux différents.

4. **Le staff ne crée pas de demande**. Le staff RÉPOND à une candidature prof. Il n'y a pas de mécanisme où le staff publie explicitement un besoin et attend les candidatures : c'est le prof qui explore les offres et candidate spontanément.

---

## E — Analyse planning des cours

### Comment le planning est-il stocké ?

Le planning est stocké sur la table `requests` (relation prof/famille active) dans trois colonnes :

```sql
requests.weekly_sessions    integer   -- nb de séances par semaine (1-7)
requests.session_hours      numeric   -- durée d'une séance (0.5-6)
requests.weekly_schedule    jsonb     -- array d'ISO datetime (jours/horaires)
```

### Peut-on créer un cours futur ?

**Non.** La table `courses` ne contient que des cours réalisés. La déclaration est strictement post-factum : le professeur saisit `hours` + `course_date` (date passée) sur une request active.

Il n'existe aucune table de cours prévisionnels ni aucune mécanique de planification automatique à partir du `weekly_schedule`.

### Le planning hebdo est-il en JSON libre ?

**Oui.** `weekly_schedule` est un `jsonb` contenant un array de chaînes ISO datetime (ex: `["2026-03-10T14:00:00Z", "2026-03-12T14:00:00Z"]`). La validation est appliquée côté API (Zod : array de z.string().datetime()), mais le schéma JSON n'est pas formellement typé en base.

### Problème structurel

Le planning hebdo (`weekly_schedule` sur `requests`) et les cours réalisés (`courses`) sont dans des tables sans lien direct. Il est impossible de :
- Savoir si un cours déclaré correspond à une séance planifiée
- Détecter une séance planifiée qui n'a pas été déclarée (absence non détectée)
- Générer automatiquement les occurrences hebdomadaires pour pré-remplir les déclarations

---

## F — Analyse validation des cours

### Workflow complet récupéré du code

```
[prof déclare un cours]
  POST /api/professor/courses
  INSERT INTO courses (..., approval_status = "family_pending", status = "pending")

[famille voit le cours]
  GET /api/family/courses
  → filtres sur approval_status

[famille accepte]
  POST /api/family/courses/respond { action: "accept", courseId }
  UPDATE courses SET approval_status = "family_confirmed", family_confirmed_at = now()

[famille conteste]
  POST /api/family/courses/respond { action: "request_change", courseId, note }
  UPDATE courses SET approval_status = "family_update_requested",
    family_update_requested_at = now(), family_update_note = note

[staff corrige]
  POST /api/staff/courses { action: "correct", courseId, hours, coursesCount, familyId, subject, note }
  UPDATE courses SET hours, courses_count, subject, staff_correction_note, staff_corrected_at, staff_corrected_by

[staff annule]
  POST /api/staff/courses { action: "cancel", courseId, note }
  UPDATE courses SET approval_status = "staff_canceled", staff_canceled_at, staff_canceled_by

[staff marque payé]
  POST /api/staff/courses { action: "mark_paid", courseId }
  UPDATE courses SET status = "paid", paid_at = now()
```

### Statuts et transitions

#### `approval_status` (parcours famille)

```
family_pending ──accept──→ family_confirmed
family_pending ──request_change──→ family_update_requested
family_update_requested ──(staff correct)──→ family_pending (?)  ← NON IMPLÉMENTÉ
family_* ──(staff cancel)──→ staff_canceled
```

**Problème :** Après une contestation famille (`family_update_requested`) et une correction staff, l'`approval_status` ne repasse pas automatiquement à `family_pending` pour que la famille re-valide. La transition "staff corrige → retour en attente famille" n'est pas gérée dans le code actuel.

#### `status` (parcours paiement)

```
pending ──mark_paid──→ paid
pending ──→ advance (avance)
pending ──→ paid_by_urssaf (circuit URSSAF)
```

Les deux statuts (`approval_status` + `status`) sont indépendants. Un cours peut être `family_pending` + `paid` — incohérence possible.

---

## G — Facturation et paie

### Les factures sont-elles générées à partir des cours validés ?

**En théorie oui**, via `invoice_lines(course_id → courses.id)`. Mais il n'existe pas de page staff pour déclencher la génération d'une facture. La logique de génération de numéro légal (`invoice_seq`) et d'association des `invoice_lines` est présente en DB mais **sans API ni UI** pour la déclencher.

La table `invoices` peut être alimentée de deux façons :
- Circuit local : `invoices` + `invoice_lines` (migration 0013)
- Circuit URSSAF : `course_invoices` + `urssaf_invoices` (migration 0012)

Ces deux circuits existent en parallèle sans arbitrage clair.

### Les bulletins sont-ils générés à partir des cours payés ?

**Partiellement.** La table `payslips` a un champ `course_ids` (jsonb) et est liée via `payslip_lines(course_id → courses.id)`. Mais comme pour les factures, il n'existe pas de déclencheur UI. Le calcul est confié à `computeCourseBreakdown` (lib payroll) mais son invocation dans le workflow de génération des bulletins n'est pas visible dans une route API dédiée.

### `computeCourseBreakdown` est-il la source officielle ?

**Oui**, c'est le seul moteur de calcul de paie réel. Il est utilisé dans `/api/professor/offers` pour les estimations (via `calculateProfPay` + `calculateTransport`). Sa sortie détaillée (cotisations ligne par ligne) n'est pas exposée au professeur dans son bulletin.

### Architecture facturation actuelle (2 circuits sans coordination)

```
Circuit A — Local (migration 0013) :
  courses → invoice_lines → invoices          (famille)
  courses → payslip_lines → payslips          (professeur)

Circuit B — URSSAF (migration 0012) :
  courses → course_invoices → urssaf_invoices (URSSAF)
  family → urssaf_clients                     (dossier URSSAF)
  family + period → monthly_statements        (relevé mensuel)
```

---

## H — Migration minimale recommandée

Objectif : atteindre le modèle cible sans réécriture totale, sans casser l'existant.

**Principe directeur :** toutes les modifications sont additives (nouvelles colonnes, nouvelles tables). Aucune suppression de colonne existante.

---

### H1 — Lier les enfants aux demandes (priorité critique)

**Problème :** `requests` et `courses` n'ont pas de `child_id`.

**Action requise :**

```sql
-- Migration 0017
ALTER TABLE public.requests
  ADD COLUMN child_id uuid REFERENCES public.family_children(id) ON DELETE SET NULL;

ALTER TABLE public.courses
  ADD COLUMN child_id uuid REFERENCES public.family_children(id) ON DELETE SET NULL;

CREATE INDEX requests_child_id_idx ON public.requests (child_id);
CREATE INDEX courses_child_id_idx ON public.courses (child_id);
```

Note : nullable intentionnel pour ne pas invalider les données historiques.

**APIs à adapter :**
- `POST /api/professor/requests` → accepter un `childId` optionnel dans le body
- `POST /api/professor/courses` → accepter un `childId` optionnel dans le body
- `GET /api/family/courses` → inclure `child_id` dans le SELECT pour affichage
- `GET /api/staff/requests` → inclure `child_id` + jointure `family_children` pour affichage

**Pages UI à mettre à jour :**
- `/professor/offers` → le formulaire "Candidater" doit permettre de choisir pour quel enfant
- `/professor/courses` → le formulaire "Déclarer un cours" doit permettre de choisir l'enfant
- `/family/courses` → afficher le prénom de l'enfant concerné
- `/staff/requests` → afficher l'enfant concerné dans la liste

---

### H2 — Séparer Application, Assignment et PlannedSchedule (priorité haute)

**Problème :** `requests` contient 3 entités distinctes.

**Action requise :** Créer deux nouvelles tables et garder `requests` uniquement pour les assignments actifs.

```sql
-- Migration 0018
-- Table des candidatures (prof candidature spontanée)
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.family_children(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES public.profiles(id),
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT applications_status_check
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'withdrawn'))
);

CREATE UNIQUE INDEX applications_unique_active_idx
  ON public.applications (professor_id, family_id, subject)
  WHERE status = 'submitted';

-- Table du planning prévu (détachée de l'assignment)
CREATE TABLE public.planned_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  weekly_sessions integer CHECK (weekly_sessions >= 1 AND weekly_sessions <= 7),
  session_hours numeric CHECK (session_hours >= 0.5 AND session_hours <= 6),
  weekly_schedule jsonb,
  first_course_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
```

**Stratégie de migration douce :**
- Conserver les colonnes `weekly_sessions`, `session_hours`, `weekly_schedule` sur `requests` pendant la transition (ne pas les supprimer)
- Les nouvelles entrées utilisent `planned_schedules`
- Les entrées historiques restent dans `requests`

---

### H3 — Introduire une table `needs` (besoins pédagogiques)

**Problème :** Il n'existe pas d'entité "besoin pédagogique d'un enfant" que le staff peut publier et gérer indépendamment des candidatures reçues.

**Action requise :**

```sql
-- Migration 0019
CREATE TABLE public.needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.family_children(id) ON DELETE CASCADE,
  subject text NOT NULL,
  target_level text,
  freq text,
  duration numeric,
  periods text[],
  notes text,
  status text NOT NULL DEFAULT 'open',
  published_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT needs_status_check
    CHECK (status IN ('draft', 'open', 'matched', 'closed'))
);

CREATE INDEX needs_family_id_idx ON public.needs (family_id);
CREATE INDEX needs_child_id_idx ON public.needs (child_id);
CREATE INDEX needs_status_idx ON public.needs (status);
```

Cette table permet au staff de :
- Créer un besoin sans attendre une candidature
- Publier explicitement un besoin aux professeurs (`status=open`)
- Voir tous les besoins non couverts (`status=open`)
- Clore un besoin une fois un prof sélectionné (`status=matched`)

---

### H4 — Corriger le workflow de validation des cours (priorité haute)

**Problème :** Après correction staff, `approval_status` ne repasse pas à `family_pending`.

**Action requise :** Dans l'API `POST /api/staff/courses { action: "correct" }`, ajouter :

```typescript
// Après la correction, remettre en attente de validation famille
approval_status: "family_pending",
family_confirmed_at: null,
```

Aucune migration DB nécessaire. Correctif applicatif uniquement.

---

### H5 — Corriger les incohérences de statut sur `courses` (priorité haute)

**Problème :** Un cours peut avoir `status=paid` ET `approval_status=family_pending` (payé avant validation).

**Action requise :**

```sql
-- Migration 0020
-- Contrainte de cohérence entre les deux statuts
ALTER TABLE public.courses
  ADD CONSTRAINT courses_status_coherence_check
  CHECK (
    status != 'paid' OR approval_status = 'family_confirmed'
  );
```

Note : à appliquer après nettoyage des données existantes incohérentes.

---

### H6 — Résoudre les UUID bruts dans les DataTables staff (priorité haute)

**Problème :** `staff/courses`, `staff/payslips`, `staff/invoices` affichent des UUIDs bruts.

**Action requise :** Modifications uniquement dans les Server Components (pages).

```typescript
// src/app/staff/courses/page.tsx
// Ajouter jointures :
.select(`..., professor:profiles!courses_professor_id_fkey(full_name), family:profiles!courses_family_id_fkey(full_name)`)

// src/app/staff/payslips/page.tsx
.select(`..., professor:profiles!payslips_professor_id_fkey(full_name)`)

// src/app/staff/invoices/page.tsx
.select(`..., family:profiles!invoices_family_id_fkey(full_name)`)

// src/app/admin/audit/page.tsx
.select(`..., actor:profiles!audit_logs_actor_id_fkey(full_name)`)
```

Aucune migration DB. Correctifs Server Component uniquement.

---

### H7 — Ajouter une page famille pour voir les enfants (priorité haute)

**Action requise :** Créer `/family/children` (page Server Component + API `GET /api/family/children`).  
La table `family_children` existe déjà, RLS déjà en place (`family_id = auth.uid()`). Effort : création de page + API GET uniquement.

---

### H8 — Supprimer l'ambiguïté des deux modèles famille (priorité moyenne)

**Problème :** `family_profiles.student_first/last/level/subjects` (mono-enfant legacy) coexistent avec `family_children` (multi-enfants).

**Action :** Déprécier progressivement les colonnes legacy. Ne pas les supprimer immédiatement.

```sql
-- Migration 0021 (après migration UI)
COMMENT ON COLUMN public.family_profiles.student_first IS 'DEPRECATED - use family_children';
COMMENT ON COLUMN public.family_profiles.student_last IS 'DEPRECATED - use family_children';
COMMENT ON COLUMN public.family_profiles.level IS 'DEPRECATED - use family_children';
COMMENT ON COLUMN public.family_profiles.subjects IS 'DEPRECATED - use family_children';
```

---

### H9 — Corriger `payslips.family_id` (priorité basse)

**Problème :** `family_id` sur `payslips` est un héritage obsolète (un bulletin regroupe tous les cours du prof, toutes familles confondues).

**Action :** Le champ est déjà nullable (migration 0014). Il suffit de s'assurer que les nouvelles insertions ne le renseignent plus. Nettoyage cosmétique, aucun impact fonctionnel.

---

### Résumé des migrations

| # | Migration | Type | Priorité |
|---|---|---|---|
| 0017 | `child_id` sur `requests` + `courses` | Schéma DB | 🔴 Critique |
| 0018 | Tables `applications` + `planned_schedules` | Schéma DB | 🔴 Haute |
| 0019 | Table `needs` (besoins pédagogiques) | Schéma DB | 🔴 Haute |
| 0020 | Contrainte cohérence status/approval_status | Schéma DB | 🟠 Haute |
| — | Fix workflow correction staff → retour family_pending | Code API | 🔴 Haute |
| — | Jointures noms dans DataTables staff | Code UI | 🔴 Haute |
| — | Page /family/children + API | Code page | 🔴 Haute |
| 0021 | Commentary DEPRECATED sur colonnes legacy | Schéma DB | 🟡 Basse |
| — | Nettoyage payslips.family_id | Code | 🟡 Basse |

---

## I — Risques techniques

### R1 — Contrainte unique sur `requests` (risque ÉLEVÉ)

```sql
UNIQUE INDEX requests_unique_pair_idx ON requests (professor_id, family_id, subject, status)
WHERE status IN ('pending', 'coords_sent', 'approved')
```

**Risque :** Cette contrainte empêche une famille d'avoir deux professeurs différents pour la même matière (ex: deux profs de maths pour deux enfants différents). Avec l'ajout de `child_id`, cette contrainte doit être revue.

**Mitigation :** En migration 0017, mettre à jour l'index unique pour inclure `child_id` :
```sql
DROP INDEX requests_unique_pair_idx;
CREATE UNIQUE INDEX requests_unique_pair_idx
  ON requests (professor_id, family_id, child_id, subject, status)
  WHERE status IN ('pending', 'coords_sent', 'approved');
```
À traiter dans la même migration que l'ajout de `child_id`.

---

### R2 — Données historiques sans `child_id` (risque MOYEN)

Toutes les `requests` et `courses` existantes auront `child_id = NULL`. Les nouvelles requêtes UI qui filtrent sur `child_id` devront gérer ce cas nullable avec un fallback gracieux.

**Mitigation :** Rendre `child_id` nullable intentionnellement. Les rows historiques restent valides mais non liées à un enfant. Ne pas rétrospectivement tenter d'assigner les `child_id` manquants (risque d'erreur d'attribution).

---

### R3 — Deux circuits de facturation sans coordination (risque ÉLEVÉ)

Circuit A (local : `invoices` + `invoice_lines`) et Circuit B (URSSAF : `course_invoices` + `urssaf_invoices`) coexistent. Un cours pourrait théoriquement être facturé dans les deux circuits.

**Mitigation :** Ajouter une contrainte applicative (pas DB) : vérifier avant insertion dans `course_invoices` que le `course_id` n'est pas déjà présent dans `invoice_lines`. À terme, choisir un seul circuit principal et désactiver l'autre.

---

### R4 — Trigger `enforce_course_status_only` strict (risque MOYEN)

Migration 0011 ajoute un trigger qui bloque les modifications au-delà des champs autorisés par rôle. L'ajout de `child_id` à `courses` nécessite de mettre à jour ce trigger pour l'exclure de la liste des champs protégés côté famille, sinon une famille ne pourra pas valider un cours qui a `child_id` renseigné.

**Mitigation :** Ajouter `child_id` à la liste des champs que la famille ne peut PAS modifier (simplement l'ajouter dans la liste `if new.child_id is distinct from old.child_id` dans `enforce_course_status_only`).

---

### R5 — Trigger `enforce_request_status_only` (risque MOYEN)

Migration 0009 ajoute un trigger similaire sur `requests`. L'ajout de `child_id` sur `requests` nécessite de mettre à jour ce trigger pour que le staff ne puisse pas modifier `child_id` une fois la request créée (immutabilité de la cible enfant).

---

### R6 — `staff/layout.tsx` sans guard de rôle (risque SÉCURITÉ MOYEN)

Contrairement à `family/layout.tsx` et `professor/layout.tsx`, le layout staff ne vérifie pas explicitement `profile.role !== 'staff'`. La protection repose uniquement sur le middleware. Un bug de middleware pourrait exposer l'espace staff à un compte famille.

**Mitigation (sans migration DB) :**
```typescript
// src/app/staff/layout.tsx
if (!user) redirect("/login");
if (profile?.role !== 'staff' && profile?.role !== 'admin') {
  redirect("/login?error=Accès+réservé");
}
```

---

### R7 — Table `applications` vs `requests` existing data (risque BAS)

La création de la table `applications` (H2) n'affecte pas les `requests` existantes. Les candidatures historiques sont dans `requests` avec `status=pending` et restent valides. Seules les nouvelles candidatures pourraient transiter par `applications`. La coexistence des deux systèmes pendant la transition est gérable mais nécessite une documentation claire pour éviter que le code mélange les deux.

**Mitigation :** Documenter explicitement la période de migration dans le code (commentaires `@deprecated` sur les routes qui créent des `requests` directement).

---

### R8 — Google Maps API key côté client (risque SÉCURITÉ MOYEN)

La clé API Google Maps est utilisée dans le browser sur `/professor/offers`. Elle est exposée dans le bundle client.

**Mitigation :** Restreindre la clé dans la console Google Cloud aux domaines autorisés uniquement (HTTP referrer restriction). Optionnellement, passer le geocoding par une route API Next.js backend.

---

*Fin de l'audit architecture métier — Sophiacademia*  
*Tables analysées : 15 tables, 16 migrations, 6 routes API clés*  
*Migrations recommandées : 5 nouvelles migrations + 4 correctifs applicatifs*
