# Audit Produit & UX — Sophiacademia
> Généré le : 2025  
> Rôle : Architecte technique  
> Périmètre : Interface existante, parcours utilisateur, workflows métier visibles

---

## A — Cartographie générale des pages

### Espace Public (non authentifié)

| Route | Type | Statut |
|---|---|---|
| `/` | Page d'accueil publique | ✅ Présente |
| `/login` | Login staff/admin | ✅ Présente |
| `/login/famille` | Login famille | ✅ Présente |
| `/login/professeur` | Login professeur | ✅ Présente |
| `/mentions-legales` | Mentions légales | ✅ Présente |
| `/politique-confidentialite` | Politique de confidentialité | ✅ Présente |
| `/cgv` | CGV | ✅ Présente |

### Espace Famille (`/family`)

| Route | Label nav | Type | Statut |
|---|---|---|---|
| `/family` | Dashboard | Server Component | ⚠️ Partiel |
| `/family/courses` | Historique cours | Client Component | ✅ Fonctionnel |
| `/family/invoices` | Mes factures | Server Component | ✅ Fonctionnel |
| `/family/profile` | Profil | Client Component | ✅ Fonctionnel |

### Espace Professeur (`/professor`)

| Route | Label nav | Type | Statut |
|---|---|---|---|
| `/professor` | Dashboard | Server Component | ⚠️ Partiel |
| `/professor/offers` | Mes offres | Client Component | ✅ Fonctionnel |
| `/professor/requests` | Planning | Client Component | ✅ Fonctionnel |
| `/professor/courses` | Mes cours | Client Component | ✅ Fonctionnel |
| `/professor/payslips` | Mes paiements | Server Component | ✅ Fonctionnel |
| `/professor/profile` | Profil | Client Component | ✅ Fonctionnel |

### Espace Staff (`/staff`)

| Route | Label nav | Type | Statut |
|---|---|---|---|
| `/staff` | Dashboard | Server Component | ❌ Placeholder |
| `/staff/families` | Gestion familles | Server Component | ✅ Fonctionnel |
| `/staff/professors` | Gestion profs | Server Component | ✅ Fonctionnel |
| `/staff/requests` | Demandes | Server Component | ✅ Fonctionnel |
| `/staff/courses` | Cours | Server Component | ⚠️ Partiel |
| `/staff/invoices` | Factures | Server Component | ⚠️ Partiel |
| `/staff/payslips` | Bulletins | Server Component | ⚠️ Partiel |

### Espace Admin (`/admin`)

| Route | Label nav | Type | Statut |
|---|---|---|---|
| `/admin` | Dashboard | Server Component | ✅ Fonctionnel |
| `/admin/families` | Gestion familles | Server Component | ✅ Fonctionnel |
| `/admin/professors` | Gestion profs | Server Component | ✅ Fonctionnel |
| `/admin/users` | Utilisateurs | Server Component | ✅ Fonctionnel |
| `/admin/users/new` | Inviter un utilisateur | Client Component | ✅ Fonctionnel |
| `/admin/requests` | Demandes | Server Component | ✅ Fonctionnel |
| `/admin/courses` | Cours | Server Component | ✅ Fonctionnel |
| `/admin/invoices` | Factures | Server Component | ✅ Fonctionnel |
| `/admin/payslips` | Bulletins | Server Component | ✅ Fonctionnel |
| `/admin/audit` | Audit | Server Component | ✅ Fonctionnel |

**Total pages recensées : 31**

---

## B — Parcours réel côté Famille

### Onboarding

1. Invitation reçue par email (créée par staff ou admin)  
2. Activation du compte via lien Supabase  
3. Connexion sur `/login/famille`  
4. Redirection vers `/family`

### Parcours principal

```
/family (dashboard) 
  → voir stats : cours du mois, heures, nb factures
  
/family/courses (historique cours)
  → filtrer par période et statut (approval_status)
  → voir les cours déclarés par le prof avec les détails
  → répondre à un cours :
      · "Accepter" → POST /api/family/courses/respond { action: "accept" }
      · "Demander correction" → idem { action: "request_change", note }
      
/family/invoices (mes factures)
  → voir toutes les factures (période, montant, statut)
  → télécharger PDF
  
/family/profile (profil)
  → modifier : prénom, nom, téléphone
  → modifier adresse complète (rue 1, rue 2, CP, ville, pays)
  → lat/lng géocodés (coordonnées stockées pour calcul distance)
```

### États `approval_status` côté famille

| Statut | Signification | Action disponible |
|---|---|---|
| `family_pending` | Cours déclaré, en attente validation famille | Accepter ou Demander correction |
| `family_confirmed` | Famille a accepté | Aucune |
| `family_update_requested` | Famille a contesté | Aucune (en attente staff) |
| `staff_canceled` | Annulé par le staff | Aucune |

### Points de friction

- Le dashboard `/family` affiche les stats mais **sans lien cliquable** vers les sous-pages
- La famille **ne voit pas ses enfants** ni la matière enseignée au niveau profil (juste ses cours)
- Pas de notification push/email visible lors d'un nouveau cours à valider
- Impossible de modifier une contestation (`request_change`) une fois envoyée

---

## C — Parcours réel côté Professeur

### Onboarding

1. Invitation reçue par email (créée par staff/admin avec profil pré-rempli : matières, niveau max, type profession)
2. Activation compte + connexion sur `/login/professeur`
3. Redirection vers `/professor`

### Parcours principal

```
/professor/offers (carte des offres)
  → Google Maps avec cercles anonymisés (position approx. des familles + rayon)
  → Liste des offres avec : enfants (prénom, classe, matières), fréquence, 
    durée session, adresse approximative, distance trajet aller
  → Prévisualisation rémunération nette estimée (net salarial, IK, forfait frais)
  → "Candidater" → POST /api/professor/requests
  → Panel détail d'une offre sélectionnée

/professor/requests (planning)
  → Liste des demandes approuvées (relation active famille/prof)
  → Statuts : coords_sent / approved
  → Formulaire brouillon par demande :
      · sessions par semaine, durée session, planning hebdo (jours/horaires)
      · Save → PATCH /api/professor/requests
      
/professor/courses (mes cours)
  [Section 1 — Demandes actives]
  → Par demande active : bouton "Déclarer un cours"
  → Formulaire de déclaration : heures, date, sélection familyId
  → POST /api/professor/courses
  [Section 2 — Historique cours]
  → DataTable : filtre par période et statut
  → Calcul distance Google Maps Routes API (trajet aller/retour)
  
/professor/payslips (mes paiements)
  → DataTable : période, numéro bulletin, net, indemnités km, statut
  → Télécharger PDF

/professor/profile (profil)
  → Modifier : prénom, nom, téléphone, puissance fiscale véhicule (CV)
  → Adresse + lat/lng (pour calcul distance)
```

### Points de friction

- Le professeur ne voit **pas les cotisations détaillées** sur son bulletin (juste net + IK)
- Sur `/professor/offers`, la distance est affichée mais le **calcul trajet réel** (Routes API) est déclenché seulement après sélection, pas en liste
- Pas de **confirmation** que la candidature a bien été reçue (toast seulement, pas de redirection vers l'offre en attente)
- Sur `/professor/requests`, le statut `coords_sent` (coordonnées envoyées) n'est pas expliqué à l'utilisateur
- Aucune page pour visualiser les **cours à venir** (déclaration seulement post-réalisation)
- Le dashboard `/professor` affiche des stats peu utiles avec la mention "Tableau de bord en cours de configuration"

---

## D — Parcours réel côté Staff

### Accès

Connexion sur `/login` (page unique staff + admin), rôle vérifié dans le middleware.

### Parcours principal

```
/staff/families (gestion familles)
  → UserListTable : liste toutes les familles
  → Cliquer → modal détail : nom, email, téléphone, adresse
  → Modifier adresse → PUT /api/staff/users/update-address

/staff/professors (gestion profs)
  → UserListTable : liste tous les professeurs
  → Cliquer → modal détail : mêmes champs
  → Modifier adresse → PUT /api/staff/users/update-address

/staff/requests (demandes)
  → RequestListTable : toutes les demandes (jointure prof + famille)
  → Cliquer sur nom prof/famille → modal contact complet
  → RequestActions disponibles selon statut :
      · status=pending      → "Envoyer coordonnées" → POST /api/staff/requests {action:"share_coords"}
      · status=coords_sent  → "Approuver"          → POST /api/staff/requests {action:"approve"}
      · status=approved     → "Dissocier"           → POST /api/staff/requests {action:"detach"}
  → Vue planning : visualisation planning hebdo de la demande

/staff/courses (cours)
  → DataTable cours (prof/famille affichés en UUID brut — bug UX)
  → CourseActions par cours :
      · "Marquer payé"    → POST /api/staff/courses {action:"mark_paid"}
      · "Corriger"        → modal form → hours, coursesCount, familyId, subject, note
                         → POST /api/staff/courses {action:"correct"}
      · "Annuler"         → POST /api/staff/courses {action:"cancel", note}
      · Boutons masqués si status="paid"

/staff/invoices (factures)
  → DataTable read-only
  → ❌ famille affichée en UUID brut
  → Aucune action disponible

/staff/payslips (bulletins)
  → DataTable read-only
  → ❌ professeur affiché en UUID brut
  → Aucune action disponible

/staff/users (invitations)
  → UserInviteForm : inviter famille ou professeur
  → UserListTable : voir tous les utilisateurs
```

### Points de friction majeurs

- `/staff` dashboard : toutes les stats affichées "-" (non connecté)
- `/staff/courses`, `/staff/payslips`, `/staff/invoices` : UUID bruts au lieu des noms
- Pas de formulaire staff pour créer une demande directement (seulement l'admin peut inviter)
- Pas de page `/staff/users` dédiée (les invitations sont mélangées à la liste)
- Workflow URSSAF (déclarations mensuelles) : **zéro interface visible**
- Pas d'action sur les bulletins (génération manuelle, statut, PDF généré côté backend)

---

## E — Parcours réel côté Admin

### Accès

Connexion sur `/login`, rôle admin requis. Navigation sidebar distincte avec 8 items.

### Parcours principal

```
/admin (dashboard)
  → StatCards : total utilisateurs, staff actifs, invitations en attente
  → Raccourcis cliquables vers /admin/users, /admin/requests, /admin/audit

/admin/families, /admin/professors
  → Même composant UserListTable (mode="admin")
  → Actions supplémentaires vs staff : modifier adresse via /api/admin/users/update-address

/admin/users (gestion tous utilisateurs)
  → Filtres role (admin/staff/family/professor/all) + statut (active/disabled/deleted)
  → Lien "Inviter un utilisateur" → /admin/users/new (UserInviteForm)
  → UserListTable complète

/admin/users/new
  → UserInviteForm complet :
      Pour famille : prénom, nom, email, téléphone, date naissance
        → Enfants multiples (add/remove) : prénom, nom, classe, matières[], fréquence, périodes[], durée
      Pour professeur : matières, niveau max, type profession (étudiant/salarié),
        école/employeur, adresse
  
/admin/requests
  → RequestListTable identique au staff avec RequestActions
  
/admin/courses
  → DataTable cours + CourseActions (identique staff)
  
/admin/invoices, /admin/payslips
  → DataTable read-only (mêmes limitations que staff — UUIDs)
  
/admin/audit
  → DataTable : 50 derniers events de la table audit_logs
  → Colonnes : action, acteur (UUID), entité, cible (UUID), détails, date
  → Acteur/cible affichés en UUID brut (pas de nom résolu)
```

### Différences admin vs staff

| Capacité | Staff | Admin |
|---|---|---|
| Inviter famille/prof | ✅ | ✅ |
| Inviter admin/staff | ❌ | ✅ |
| Voir audit trail | ❌ | ✅ |
| Dashbord global | ❌ (placeholder) | ✅ (3 stats réelles) |
| Filtrer utilisateurs par rôle/statut | ❌ | ✅ |
| Désactiver/supprimer un utilisateur | Partiel | ✅ |

---

## F — Écrans et formulaires existants

### Formulaires de saisie

| Formulaire | Route | Champs | API cible |
|---|---|---|---|
| Login famille | `/login/famille` | email, password | `/api/auth/login/famille` |
| Login professeur | `/login/professeur` | email, password | `/api/auth/login/professeur` |
| Login staff/admin | `/login` | email, password, role_hint | `/api/auth/login` |
| Profil famille | `/family/profile` | prénom, nom, téléphone, addr1, addr2, CP, ville, pays, lat, lng | `/api/family/profile` |
| Profil professeur | `/professor/profile` | prénom, nom, téléphone, carHp, adresse, lat, lng | `/api/professor/profile` |
| Réponse cours famille | `/family/courses` | action (accept/request_change), note | `/api/family/courses/respond` |
| Déclaration cours prof | `/professor/courses` | familyId, heures, date | `/api/professor/courses` |
| Candidature offre | `/professor/offers` | requestId (via offerId) | `/api/professor/requests` |
| Planning demande | `/professor/requests` | weeklySessions, sessionHours, weeklySchedule[] | `/api/professor/requests PATCH` |
| Inviter utilisateur | `/admin/users/new` + `/staff/users` | role, tous champs profil + enfants | `/api/admin/invite` ou équivalent |
| Corriger un cours | `/staff/courses` (modal) | hours, coursesCount, familyId, subject, note | `/api/staff/courses {action:"correct"}` |
| Modifier adresse | `UserListTable` (modal) | addr1, addr2, CP, ville, pays | `/api/admin/users/update-address` ou `/api/staff/users/update-address` |

### Vues de consultation (read-only)

| Vue | Route | Données affichées |
|---|---|---|
| Dashboard famille | `/family` | cours du mois, heures totales, nb factures |
| Dashboard professeur | `/professor` | cours actifs, cours du mois, bulletins (stats vides) |
| Dashboard admin | `/admin` | total users, staff actifs, invitations en attente |
| Factures famille | `/family/invoices` | période, montant, statut, lien PDF |
| Bulletins prof | `/professor/payslips` | période, numéro, net, IK, statut, lien PDF |
| Carte offres | `/professor/offers` | cercles anonymisés, distance, rémunération estimée |
| Audit trail | `/admin/audit` | 50 dernières actions admin |

---

## G — Workflows réels actuellement possibles

### Workflow 1 — Mise en relation famille/professeur (complet)

```
[Admin/Staff]  Inviter une famille            → profil créé + enfants
[Admin/Staff]  Inviter un professeur          → profil créé + compétences
[Professeur]   Voir offres sur la carte       → famille visible de façon anonyme
[Professeur]   Candidater sur une offre       → request créée (status: pending)
[Staff/Admin]  Voir la demande                → RequestListTable
[Staff/Admin]  Envoyer les coordonnées        → status: coords_sent
[Staff/Admin]  Approuver la demande           → status: approved
[Professeur]   Voir la demande approuvée      → /professor/requests
[Professeur]   Renseigner le planning         → weeklySessions, sessionHours, weeklySchedule
```

### Workflow 2 — Déclaration et validation d'un cours (complet mais UX partielle)

```
[Professeur]   Déclarer un cours              → /professor/courses → POST /api/professor/courses
[Famille]      Voir le cours (status: family_pending)  → /family/courses
[Famille]      Accepter le cours              → approval_status: family_confirmed
  OU
[Famille]      Contester le cours             → approval_status: family_update_requested + note
[Staff]        Voir le cours                  → /staff/courses
[Staff]        Corriger si nécessaire         → action: correct
[Staff]        Marquer payé                   → action: mark_paid (status: paid)
```

### Workflow 3 — Gestion des bulletins (partiel)

```
[Backend]      Calcul automatique via computeCourseBreakdown (complet, non affiché)
[Staff]        /staff/payslips — voir liste   → read-only, UUID prof affiché
[Professeur]   /professor/payslips — voir     → net + IK + PDF
```

### Workflow 4 — Gestion des factures (partiel)

```
[Backend]      Génération facture             → logique présente
[Staff]        /staff/invoices — voir liste   → read-only, UUID famille affiché
[Famille]      /family/invoices — voir        → montant + PDF
```

### Workflow 5 — Fin de relation (partiel)

```
[Staff/Admin]  Dissocier famille/prof         → action: detach sur request approved
  → Aucune UI de suivi de la raison de fin (end_reason existe en DB mais pas affiché)
  → Aucune UI de clôture de fin de contrat
```

---

## H — Gestion des familles, enfants, demandes multiples

### Ce qui existe

- `UserInviteForm` gère **plusieurs enfants par famille** lors de l'invitation :
  - Par enfant : prénom, nom, classe (`LEVELS` catalog), matières (`SUBJECTS` catalog)
  - Fréquence (hebdo/bimensuel), périodes souhaitées[], durée de session

### Ce qui manque

- **Aucune page famille pour voir ses propres enfants** — le compte famille ne voit nulle part la liste de ses enfants
- **Une demande = une relation prof/famille** — pas de liaison enfant dans la table `requests` (pas de `child_id`)
- Si une famille a 3 enfants avec des profs différents → 3 demandes distinctes sans regroupement par famille
- **Pas de gestion de demandes multiples par enfant** (deux profs pour deux matières pour le même enfant)
- Les cours déclarés n'indiquent pas *pour quel enfant* ils sont (juste familyId + subject)
- Modification des enfants après création : **impossible via l'interface** (admin/staff n'a pas d'écran dédié)

### Impact architectural critique

La structure actuelle traite la famille comme un compte unique, non comme une entité avec des enfants. Le modèle `requests(id, professor_id, family_id, subject)` ne permet pas de différencier les cours par enfant si une famille a plusieurs enfants en même matière avec des profs différents.

---

## I — Planning et gestion des cours

### Ce qui existe

- `/professor/requests` : le professeur peut renseigner un **planning hebdomadaire** (jours, horaires, nb sessions/semaine, durée)
- Ce planning est stocké dans `requests.weekly_schedule` (jsonb) et visible dans le `RequestListTable` (vue planning staff)
- `/professor/courses` : déclaration **post-réalisation** uniquement (heures + date passée)

### Ce qui manque

- **Aucun calendrier visuel** — pas de vue agenda semaine/mois côté staff ni prof ni famille
- Pas de **planning futur** — on ne sait pas quand auront lieu les prochains cours
- Pas de **vue consolidated** staff des plannings de tous les profs (pour détecter conflits ou absences)
- Pas de **gestion des absences ou annulations** de cours à venir
- Pas de mécanisme de **rappel ou notification** avant un cours
- Le champ `weekly_schedule` est un tableau JSON libre, sans validation stricte de format

---

## J — Mapping pages / composants / APIs / tables

### Composants réutilisables

| Composant | Utilisé sur | Rôle |
|---|---|---|
| `AppShell` | Tous les layouts | Sidebar + contenu + user info |
| `SidebarNav` | Via AppShell | Navigation latérale par rôle |
| `DataTable` | Partout | Tableau générique colonnes/lignes |
| `RequestListTable` | staff/requests, admin/requests | Tableau demandes + modal contact + vue planning |
| `RequestActions` | Dans RequestListTable | Boutons action par statut de demande |
| `CourseActions` | staff/courses, admin/courses | Boutons mark_paid / correct / cancel |
| `UserListTable` | staff/* , admin/* | Tableau utilisateurs + modal adresse |
| `UserInviteForm` | staff/users, admin/users/new | Formulaire invitation multi-rôle + multi-enfants |
| `ConfirmDialog` | RequestActions, CourseActions | Dialogue de confirmation |

### APIs et tables associées

| API Route | Méthode | Table(s) | Appelant |
|---|---|---|---|
| `/api/auth/login` | POST | `profiles`, `auth.users` | Login pages |
| `/api/auth/logout` | POST | `auth.users` | AppShell topbar |
| `/api/family/courses` | GET | `courses` JOIN `requests` | family/courses |
| `/api/family/courses/respond` | POST | `courses` | family/courses |
| `/api/family/invoices` | GET | `invoices` | family/invoices |
| `/api/family/profile` | GET/PUT | `profiles` | family/profile |
| `/api/professor/offers` | GET | `offers` ou `requests` JOIN `profiles` | professor/offers |
| `/api/professor/requests` | POST/PATCH | `requests` | professor/offers, professor/requests |
| `/api/professor/courses` | GET/POST | `courses` | professor/courses |
| `/api/professor/payslips` | GET | `payslips` | professor/payslips |
| `/api/professor/profile` | GET/PUT | `profiles` | professor/profile |
| `/api/staff/requests` | POST | `requests` | RequestActions |
| `/api/staff/courses` | POST | `courses` | CourseActions |
| `/api/staff/users/update-address` | PUT | `profiles` | UserListTable (mode=staff) |
| `/api/admin/users/update-address` | PUT | `profiles` | UserListTable (mode=admin) |
| `/api/admin/invite` | POST | `profiles`, `auth.users` | UserInviteForm |

### Tables principales (référencées dans l'UI)

| Table | Usage principal |
|---|---|
| `profiles` | Identité de tous les utilisateurs (role, full_name, email, phone, adresse, lat, lng) |
| `requests` | Relation prof/famille (statut, planning, subject) |
| `courses` | Cours déclarés (heures, date, approval_status, statuts paiement) |
| `invoices` | Factures famille |
| `payslips` | Bulletins professeur |
| `audit_logs` | Trail des actions admin |
| `children` | Enfants de famille (utilisé à l'invite, pas visible dans l'UI) |

---

## K — Ce qui est visible et fonctionnel

### Côté Famille ✅

- Voir ses cours déclarés avec filtres (période, statut)
- Valider ou contester un cours (action + note)
- Voir ses factures avec PDF
- Modifier son profil + adresse + géolocalisation

### Côté Professeur ✅

- Voir les offres anonymisées sur Google Maps
- Voir la rémunération estimée (net, IK, forfait frais) avant de candidater
- Candidater sur une offre
- Renseigner son planning hebdo sur une demande approuvée
- Déclarer un cours réalisé depuis une demande active
- Voir l'historique de ses cours
- Voir ses bulletins avec net + IK + PDF
- Modifier son profil + adresse + puissance fiscale

### Côté Staff ✅

- Inviter familles (avec enfants multiples) et professeurs
- Voir la liste des familles et professeurs avec coordonnées
- Modifier l'adresse d'un utilisateur
- Suivre toutes les demandes avec les coordonnées de contact
- Faire avancer une demande (share_coords → approve → detach)
- Voir le planning hebdo d'une demande
- Voir les cours déclarés et les corriger, annuler, marquer payé

### Côté Admin ✅

- Dashboard avec métriques globales réelles (users, staff, invitations)
- Tout ce que fait le staff +
- Filtrer les utilisateurs par rôle et statut
- Voir l'audit trail des 50 dernières actions
- Inviter des comptes staff et admin (pas seulement famille/prof)

---

## L — Ce qui existe en backend mais sans interface utilisateur

### Moteur de paie complet (`src/lib/payroll/computeCourseBreakdown.ts`)

- Calcule le détail ligne par ligne : salaire brut, cotisations patronales, cotisations salariales, net imposable, net versé, IK
- Utilisé pour les estimations dans `/professor/offers` (rémunération prévisionnelle)
- **Non affiché** sur les bulletins prof (UI montre seulement net total + IK)
- Aucune page "simulation de paie" accessible

### Circuit URSSAF (`src/lib/urssaf/`)

- Module complet présent en backend
- **Zéro interface** pour déclencher, voir ou suivre les déclarations URSSAF
- Aucun workflow visible pour le staff

### Auto-paiement (`auto-pay`)

- Stub vide — logique d'automatisation des virements non implémentée
- Aucun écran de configuration ou déclenchement

### Génération PDF (bulletins et factures)

- La route PDF existe (lien cliquable dans les DataTables)
- Le rendu réel est du texte brut ou HTML basique (pas de template PDF structuré)
- Pas de prévisualisation dans l'application

### Gestion de l'état `end_reason` sur les demandes

- Le champ `requests.end_reason` existe en DB (raison de fin de contrat)
- Aucun champ visible dans l'UI pour capturer ou afficher cette raison

### Table `children`

- Les enfants sont créés lors de l'invitation famille (via `UserInviteForm`)
- **Jamais affichés** dans l'interface — ni côté famille, ni côté staff au quotidien
- Aucune page pour modifier les informations d'un enfant après création

---

## M — Ce qui manque complètement

### Manques critiques (bloquants pour un ERP complet)

| Fonctionnalité | Impact | Priorité |
|---|---|---|
| Staff dashboard avec vraies stats | Opérationnel | 🔴 Haute |
| Noms dans staff/courses, payslips, invoices (UUIDs affichés) | Opérationnel quotidien | 🔴 Haute |
| Page enfants au niveau famille | Autonomie famille | 🔴 Haute |
| Liaison cours → enfant (child_id dans requests/courses) | Modèle de données | 🔴 Haute |
| Interface URSSAF | Conformité légale | 🔴 Haute |
| Calendrier / planning visuel (agenda) | Pilotage | 🔴 Haute |

### Manques importants

| Fonctionnalité | Impact | Priorité |
|---|---|---|
| Notifications (email/push) à chaque changement de statut | UX | 🟠 Moyenne |
| Simulation de paie accessible (pas seulement dans les offres) | Transparence prof | 🟠 Moyenne |
| Historique d'évolution d'une demande (timeline) | Traçabilité | 🟠 Moyenne |
| Formulaire de création de demande par staff | Opérationnel | 🟠 Moyenne |
| Modification d'une demande existante (matière, planning) | Opérationnel | 🟠 Moyenne |
| Attestations fiscales annuelles famille | Légal | 🟠 Moyenne |
| PDF structurés (bulletins + factures) | Légal/Comptable | 🟠 Moyenne |
| Audit trail lisible (noms au lieu d'UUIDs) | Admin | 🟠 Moyenne |

### Manques secondaires

| Fonctionnalité | Impact | Priorité |
|---|---|---|
| Gestion des absences / annulations de cours à venir | Pilotage | 🟡 Faible |
| Dashboard prof avec graphiques (évolution revenus) | Rétention prof | 🟡 Faible |
| Export CSV des cours/factures/bulletins | Comptabilité | 🟡 Faible |
| Multi-demandes par enfant (plusieurs profs/matières) | Croissance | 🟡 Faible |
| Page profil public prof (bio, disponibilités) | Matching | 🟡 Faible |
| Messagerie interne famille/prof/staff | Communication | 🟡 Faible |
| CGU acceptation tracée à l'inscription | Légal | 🟡 Faible |

---

## N — Recommandations d'architecture produit avant codage

### 1. Corriger immédiatement (avant toute nouvelle feature)

**a) UUID → Noms dans staff/courses, staff/payslips, staff/invoices**  
Faire des jointures côté server component et afficher `full_name`. Effort : 1-2h.

**b) Staff dashboard branché sur des vraies données**  
3 requêtes SQL simples (nb cours du mois, nb demandes actives, nb profs actifs). Effort : 2h.

**c) Audit trail : résoudre les UUIDs en noms**  
JOIN `profiles` sur `actor_id` et `target_user_id` dans `/admin/audit`. Effort : 1h.

---

### 2. Refactoriser le modèle de données avant d'étendre

**a) Relier `requests` aux enfants**  
```sql
-- Ajouter child_id à requests
ALTER TABLE requests ADD COLUMN child_id uuid REFERENCES children(id);
-- Ajouter child_id à courses
ALTER TABLE courses ADD COLUMN child_id uuid REFERENCES children(id);
```
Sans ce changement, impossible de distinguer les cours par enfant dans une famille multi-enfants.

**b) Clarifier le modèle `offers` vs `requests`**  
Actuellement, une offre candidatée crée directement une `request`. Il manque un état intermédiaire `candidature` (prof intéressé → staff valide → request créée). Sans cela, une candidature refusée n'est pas tracée.

**c) Normaliser `weekly_schedule`**  
Le champ JSONB `weekly_schedule` est libre. Définir un schéma strict (TypeScript + Zod) pour garantir la cohérence des données planning.

---

### 3. Architecture recommandée pour les prochains développements

**Couche données à ajouter :**
```
children      ← déjà en DB, non exposé dans l'UI
offers        ← à distinguer de requests
candidatures  ← état intermédiaire entre offre et request
absences      ← gestion annulations cours futurs
notifications ← système de notifications internes
```

**Pages à créer en priorité :**

| Page | Rôle | Description |
|---|---|---|
| `/family/children` | Famille | Voir/modifier ses enfants |
| `/professor/planning` | Professeur | Agenda semaine avec cours à venir |
| `/staff/planning` | Staff | Vue consolidée planning tous profs |
| `/staff/urssaf` | Staff | Déclarations mensuelles URSSAF |
| `/staff/payslips/generate` | Staff | Déclencher la génération des bulletins |
| `/admin/settings` | Admin | Configuration globale (taux URSSAF, tarifs) |

**Patterns à standardiser côté code :**

1. **Résolution UUID → nom** : créer un helper `resolveProfileName(id)` ou enrichir les requêtes systématiquement
2. **Toast + invalidation** : unifier le pattern optimistic update (actuellement mixé server refresh + state local)
3. **DataTable avec actions** : créer un `DataTable<T>` générique avec colonne actions optionnelle (éviter la duplication entre `CourseActions`, `RequestActions`)
4. **Formulaires Zod + react-hook-form** : `UserInviteForm` fait 557 lignes avec validation manuelle — migrer vers react-hook-form + Zod
5. **Séparation lecture/écriture des Server Components** : les pages staff font la lecture en server component (bien) mais les actions via client (bien) — continuer ce pattern

**Risques identifiés :**

| Risque | Criticité | Mitigation |
|---|---|---|
| RLS sur `children` non testé avec multi-enfants | 🔴 | Tester l'isolation famille A vs B |
| `computeCourseBreakdown` non testé unitairement si visible dans l'UI | 🔴 | Ajouter tests avant d'exposer les détails |
| Google Maps API key exposée côté client | 🟠 | Passer via route API backend pour geocoding |
| URSSAF zéro interface = risque de non-conformité | 🔴 | Prioriser avant mise en production réelle |
| `staff/layout.tsx` sans guard de rôle (contrairement à famille/prof) | 🟠 | Ajouter `if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect(...)` |

---

*Fin de l'audit — Sophiacademia v1 — Périmètre : 31 pages, 9 composants, ~15 routes API*
