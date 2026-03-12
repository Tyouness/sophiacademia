/**
 * BackgroundEducationalPattern
 *
 * Rendu correct garanti : couleurs hex hard-codées (pas de currentColor ni de
 * classes Tailwind à l'intérieur des <defs> SVG — le cascade CSS ne s'applique
 * pas de façon fiable dans les contextes <pattern>).
 *
 * Opacité :
 *   mobile  → 0.05  (visible mais discret)
 *   desktop → 0.07  (légèrement plus perceptible)
 *
 * Le composant parent (layout) doit être :
 *   <div className="fixed inset-0 -z-10 pointer-events-none">
 */
export default function BackgroundEducationalPattern() {
  const C = "#1E3A5F"; // brand-royal — visible à basse opacité, cohérent avec la palette

  return (
    <div aria-hidden className="h-full w-full overflow-hidden">
      {/* Opacité séparée du SVG pour éviter tout conflit de cascade */}
      <div className="h-full w-full opacity-[0.05] md:opacity-[0.07]">
        <svg
          className="h-full w-full"
          viewBox="0 0 1440 1024"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/*
              Tuile 380×280 — contenu :
              ▸ Crayons (silhouettes solides)
              ▸ Stylos
              ▸ Livres (ouverts et fermés)
              ▸ Feuilles
              ▸ Équations : x², E=mc², ∫, √16, a²+b²=c², F=ma, π≈3.14, y=ax+b
              ▸ Dates : 1789, 1914, 1945, 1969
              ▸ Citation : « Apprendre pour comprendre »
            */}
            <pattern
              id="edu-bg-pattern"
              width="380"
              height="280"
              patternUnits="userSpaceOnUse"
            >

              {/* ─── RANGÉE 1 (y ≈ 0–55) ─── */}

              {/* Crayon 1 — incliné -15° */}
              <g transform="translate(18,22) rotate(-15)">
                <rect x="0" y="-5" width="34" height="10" rx="1.5" fill={C} />
                <polygon points="34,-5 43,0 34,5" fill={C} />
                <rect x="0" y="-5" width="7" height="10" rx="1" fill={C} opacity="0.5" />
              </g>

              {/* Date */}
              <text x="72" y="26" fontSize="13" fill={C} fontFamily="Georgia, serif">1789</text>

              {/* Livre ouvert 1 */}
              <g transform="translate(122,8)">
                <rect x="0" y="0" width="16" height="22" rx="1" fill="none" stroke={C} strokeWidth="1.6" />
                <rect x="18" y="0" width="16" height="22" rx="1" fill="none" stroke={C} strokeWidth="1.6" />
                <line x1="17" y1="0" x2="17" y2="22" stroke={C} strokeWidth="1.6" />
                <line x1="2" y1="6" x2="14" y2="6" stroke={C} strokeWidth="1" />
                <line x1="2" y1="11" x2="14" y2="11" stroke={C} strokeWidth="1" />
                <line x1="2" y1="16" x2="14" y2="16" stroke={C} strokeWidth="1" />
                <line x1="20" y1="6" x2="32" y2="6" stroke={C} strokeWidth="1" />
                <line x1="20" y1="11" x2="32" y2="11" stroke={C} strokeWidth="1" />
              </g>

              {/* Équation x² */}
              <text x="172" y="28" fontSize="16" fill={C} fontFamily="Georgia, serif" fontStyle="italic">x²</text>

              {/* Équation E=mc² */}
              <text x="200" y="28" fontSize="12" fill={C} fontFamily="Georgia, serif">E = mc²</text>

              {/* Date */}
              <text x="272" y="26" fontSize="13" fill={C} fontFamily="Georgia, serif">1914</text>

              {/* Stylo 1 — incliné 22° */}
              <g transform="translate(328,10) rotate(22)">
                <ellipse cx="16" cy="0" rx="16" ry="4" fill={C} />
                <polygon points="30,-4 40,0 30,4" fill={C} />
                <rect x="0" y="-4" width="6" height="8" rx="1" fill={C} opacity="0.45" />
              </g>

              {/* ─── RANGÉE 2 (y ≈ 75–135) ─── */}

              {/* Intégrale ∫ */}
              <text x="10" y="118" fontSize="32" fill={C} fontFamily="Georgia, serif">∫</text>

              {/* Feuille 1 — inclinée -30° */}
              <g transform="translate(52,84) rotate(-30)">
                <path d="M 0,12 C 5,-3 20,-3 20,12 C 20,27 5,27 0,12 Z" fill="none" stroke={C} strokeWidth="1.5" />
                <line x1="0" y1="12" x2="20" y2="12" stroke={C} strokeWidth="1" />
                <line x1="10" y1="1" x2="10" y2="23" stroke={C} strokeWidth="0.9" />
              </g>

              {/* Citation */}
              <text x="82" y="100" fontSize="10" fill={C} fontFamily="Georgia, serif" fontStyle="italic">« Apprendre pour comprendre »</text>

              {/* √16 = 4 */}
              <text x="82" y="120" fontSize="13" fill={C} fontFamily="Georgia, serif">√16 = 4</text>

              {/* Date */}
              <text x="188" y="112" fontSize="13" fill={C} fontFamily="Georgia, serif">1945</text>

              {/* Livre fermé 2 — incliné 5° */}
              <g transform="translate(254,80) rotate(5)">
                <rect x="0" y="0" width="30" height="36" rx="2" fill="none" stroke={C} strokeWidth="1.6" />
                <rect x="3" y="0" width="5" height="36" rx="1" fill={C} opacity="0.25" />
                <line x1="8" y1="9" x2="27" y2="9" stroke={C} strokeWidth="1" />
                <line x1="8" y1="15" x2="27" y2="15" stroke={C} strokeWidth="1" />
                <line x1="8" y1="21" x2="27" y2="21" stroke={C} strokeWidth="1" />
                <line x1="8" y1="27" x2="27" y2="27" stroke={C} strokeWidth="1" />
              </g>

              {/* π ≈ 3.14 */}
              <text x="308" y="112" fontSize="12" fill={C} fontFamily="Georgia, serif">π ≈ 3.14</text>

              {/* ─── RANGÉE 3 (y ≈ 152–205) ─── */}

              {/* Crayon 2 — incliné 8° */}
              <g transform="translate(8,162) rotate(8)">
                <rect x="0" y="-5" width="38" height="10" rx="1.5" fill={C} />
                <polygon points="38,-5 47,0 38,5" fill={C} />
                <rect x="0" y="-5" width="8" height="10" rx="1" fill={C} opacity="0.45" />
              </g>

              {/* a² + b² = c² */}
              <text x="62" y="172" fontSize="12" fill={C} fontFamily="Georgia, serif">a² + b² = c²</text>

              {/* Date */}
              <text x="172" y="168" fontSize="13" fill={C} fontFamily="Georgia, serif">1969</text>

              {/* Feuille 2 — inclinée 40° */}
              <g transform="translate(228,152) rotate(40)">
                <path d="M 0,11 C 4,-2 17,-2 17,11 C 17,24 4,24 0,11 Z" fill="none" stroke={C} strokeWidth="1.4" />
                <line x1="0" y1="11" x2="17" y2="11" stroke={C} strokeWidth="0.9" />
                <line x1="8.5" y1="1" x2="8.5" y2="21" stroke={C} strokeWidth="0.8" />
              </g>

              {/* Stylo 2 — incliné -25° */}
              <g transform="translate(270,154) rotate(-25)">
                <ellipse cx="15" cy="0" rx="15" ry="3.5" fill={C} />
                <polygon points="28,-3.5 38,0 28,3.5" fill={C} />
              </g>

              {/* Δy/Δx */}
              <text x="322" y="178" fontSize="12" fill={C} fontFamily="Georgia, serif">Δy/Δx</text>

              {/* ─── RANGÉE 4 (y ≈ 222–272) ─── */}

              {/* Livre ouvert 3 — incliné -6° */}
              <g transform="translate(10,228) rotate(-6)">
                <rect x="0" y="0" width="15" height="20" rx="1" fill="none" stroke={C} strokeWidth="1.4" />
                <rect x="16" y="0" width="15" height="20" rx="1" fill="none" stroke={C} strokeWidth="1.4" />
                <line x1="15.5" y1="0" x2="15.5" y2="20" stroke={C} strokeWidth="1.4" />
              </g>

              {/* ✎ (glyphe crayon Unicode) */}
              <text x="48" y="252" fontSize="17" fill={C} fontFamily="sans-serif">✎</text>

              {/* y = ax + b */}
              <text x="72" y="252" fontSize="13" fill={C} fontFamily="Georgia, serif">y = ax + b</text>

              {/* Date (atténuée) */}
              <text x="178" y="246" fontSize="11" fill={C} fontFamily="Georgia, serif" opacity="0.7">1914</text>

              {/* Feuille 3 — inclinée -20° */}
              <g transform="translate(228,224) rotate(-20)">
                <path d="M 0,11 C 4,-1 17,-1 17,11 C 17,23 4,23 0,11 Z" fill="none" stroke={C} strokeWidth="1.3" />
                <line x1="0" y1="11" x2="17" y2="11" stroke={C} strokeWidth="0.8" />
              </g>

              {/* Crayon 3 — incliné -30° */}
              <g transform="translate(268,225) rotate(-30)">
                <rect x="0" y="-4" width="30" height="8" rx="1.5" fill={C} />
                <polygon points="30,-4 38,0 30,4" fill={C} />
                <rect x="0" y="-4" width="6" height="8" rx="1" fill={C} opacity="0.45" />
              </g>

              {/* F = ma */}
              <text x="318" y="246" fontSize="12" fill={C} fontFamily="Georgia, serif">F = ma</text>

            </pattern>
          </defs>

          {/* Remplissage plein viewport avec le pattern */}
          <rect width="1440" height="1024" fill="url(#edu-bg-pattern)" />
        </svg>
      </div>
    </div>
  );
}
