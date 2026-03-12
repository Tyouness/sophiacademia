/**
 * LightSectionPattern
 *
 * SVG éducatif répétable pour les sections à fond clair (blanc / crème).
 * Position : absolute inset-0, pointer-events-none, z-0.
 * Opacité calibrée : desktop 0.04 / mobile 0.025
 *
 * Usage dans une section :
 *   <section className="relative overflow-hidden" style={{ backgroundColor: "#FAF7F2" }}>
 *     <LightSectionPattern />
 *     <div className="relative z-10 ...">
 *       contenu
 *     </div>
 *   </section>
 */
export default function LightSectionPattern() {
  const C = "#1E3A5F"; // brand-royal — perceptible à très basse opacité

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* desktop opacity */}
      <div className="hidden md:block h-full w-full" style={{ opacity: 0.04 }}>
        <PatternSvg C={C} />
      </div>
      {/* mobile opacity (encore plus discret) */}
      <div className="block md:hidden h-full w-full" style={{ opacity: 0.025 }}>
        <PatternSvg C={C} />
      </div>
    </div>
  );
}

function PatternSvg({ C }: { C: string }) {
  return (
    <svg
      className="h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/*
          Tuile 420×300
          Contenu disposé de manière asymétrique (effet cahier d'étudiant) :
          ▸ Crayons & stylos (paths solides)
          ▸ Livres ouverts & fermés
          ▸ Feuilles organiques
          ▸ Équations : ∫ x² E=mc² √ Δ π a²+b²=c² F=ma y=ax+b
          ▸ Dates : 1789 1914 1945 1969
          ▸ Formules physiques
        */}
        <pattern
          id="light-edu-pattern"
          width="420"
          height="300"
          patternUnits="userSpaceOnUse"
        >
          {/* ── ROW A ── */}

          {/* Crayon 1 — incliné -18° */}
          <g transform="translate(16,18) rotate(-18)">
            <rect x="0" y="-5" width="36" height="10" rx="1.5" fill={C} />
            <polygon points="36,-5 46,0 36,5" fill={C} />
            <rect x="0" y="-5" width="7" height="10" rx="1" fill={C} opacity="0.45" />
          </g>

          {/* Date 1789 */}
          <text x="76" y="24" fontSize="13" fill={C} fontFamily="Georgia, serif" fontWeight="600">1789</text>

          {/* Livre ouvert A */}
          <g transform="translate(136,6)">
            <rect x="0" y="0" width="17" height="23" rx="1" fill="none" stroke={C} strokeWidth="1.6" />
            <rect x="19" y="0" width="17" height="23" rx="1" fill="none" stroke={C} strokeWidth="1.6" />
            <line x1="18" y1="0" x2="18" y2="23" stroke={C} strokeWidth="1.6" />
            <line x1="2" y1="7"  x2="15" y2="7"  stroke={C} strokeWidth="1" />
            <line x1="2" y1="12" x2="15" y2="12" stroke={C} strokeWidth="1" />
            <line x1="2" y1="17" x2="15" y2="17" stroke={C} strokeWidth="1" />
            <line x1="21" y1="7"  x2="34" y2="7"  stroke={C} strokeWidth="1" />
            <line x1="21" y1="12" x2="34" y2="12" stroke={C} strokeWidth="1" />
          </g>

          {/* ∫ intégrale */}
          <text x="180" y="30" fontSize="30" fill={C} fontFamily="Georgia, serif">∫</text>

          {/* E = mc² */}
          <text x="215" y="26" fontSize="12" fill={C} fontFamily="Georgia, serif">E = mc²</text>

          {/* Date 1914 */}
          <text x="290" y="22" fontSize="13" fill={C} fontFamily="Georgia, serif" fontWeight="600">1914</text>

          {/* Stylo A — incliné 20° */}
          <g transform="translate(348,8) rotate(20)">
            <ellipse cx="17" cy="0" rx="17" ry="4.5" fill={C} />
            <polygon points="32,-4.5 43,0 32,4.5" fill={C} />
            <rect x="0" y="-4.5" width="7" height="9" rx="1" fill={C} opacity="0.4" />
          </g>

          {/* Date 1945 (coin droit) */}
          <text x="390" y="52" fontSize="11" fill={C} fontFamily="Georgia, serif" opacity="0.7">1945</text>

          {/* ── ROW B (y ≈ 70–145) ── */}

          {/* Feuille B1 — inclinée -35° */}
          <g transform="translate(10,86) rotate(-35)">
            <path d="M 0,13 C 5,-3 22,-3 22,13 C 22,29 5,29 0,13 Z" fill="none" stroke={C} strokeWidth="1.5" />
            <line x1="0" y1="13" x2="22" y2="13" stroke={C} strokeWidth="1" />
            <line x1="11"  y1="1"  x2="11" y2="25" stroke={C} strokeWidth="0.9" />
          </g>

          {/* Citation / formule isolée */}
          <text x="48"  y="96"  fontSize="10" fill={C} fontFamily="Georgia, serif" fontStyle="italic">« Apprendre, c&apos;est découvrir »</text>
          <text x="48"  y="114" fontSize="13" fill={C} fontFamily="Georgia, serif">√x² = |x|</text>

          {/* Date 1969 */}
          <text x="200" y="112" fontSize="13" fill={C} fontFamily="Georgia, serif" fontWeight="600">1969</text>

          {/* Livre fermé B */}
          <g transform="translate(264,76) rotate(4)">
            <rect x="0" y="0" width="32" height="38" rx="2" fill="none" stroke={C} strokeWidth="1.6" />
            <rect x="3" y="0" width="5" height="38" rx="1" fill={C} opacity="0.22" />
            <line x1="8" y1="10" x2="29" y2="10" stroke={C} strokeWidth="1" />
            <line x1="8" y1="16" x2="29" y2="16" stroke={C} strokeWidth="1" />
            <line x1="8" y1="22" x2="29" y2="22" stroke={C} strokeWidth="1" />
            <line x1="8" y1="28" x2="29" y2="28" stroke={C} strokeWidth="1" />
          </g>

          {/* π ≈ 3.14 */}
          <text x="316" y="112" fontSize="12" fill={C} fontFamily="Georgia, serif">π ≈ 3.14</text>

          {/* ✎ glyphe crayon */}
          <text x="368" y="105" fontSize="19" fill={C} fontFamily="sans-serif" opacity="0.8">✎</text>

          {/* ── ROW C (y ≈ 162–218) ── */}

          {/* Crayon C — incliné 10° */}
          <g transform="translate(6,168) rotate(10)">
            <rect x="0" y="-5" width="40" height="10" rx="1.5" fill={C} />
            <polygon points="40,-5 50,0 40,5" fill={C} />
            <rect x="0" y="-5" width="8" height="10" rx="1" fill={C} opacity="0.4" />
          </g>

          {/* a² + b² = c² */}
          <text x="64"  y="178" fontSize="12" fill={C} fontFamily="Georgia, serif">a² + b² = c²</text>

          {/* Δy/Δx */}
          <text x="190" y="178" fontSize="12" fill={C} fontFamily="Georgia, serif">Δy / Δx</text>

          {/* Feuille C2 — inclinée 45° */}
          <g transform="translate(248,162) rotate(45)">
            <path d="M 0,11 C 4,-2 18,-2 18,11 C 18,24 4,24 0,11 Z" fill="none" stroke={C} strokeWidth="1.4" />
            <line x1="0" y1="11" x2="18" y2="11" stroke={C} strokeWidth="0.9" />
            <line x1="9" y1="1"  x2="9"  y2="21" stroke={C} strokeWidth="0.8" />
          </g>

          {/* Stylo C — incliné -28° */}
          <g transform="translate(288,164) rotate(-28)">
            <ellipse cx="16" cy="0" rx="16" ry="4" fill={C} />
            <polygon points="30,-4 40,0 30,4" fill={C} />
          </g>

          {/* F = ma */}
          <text x="344" y="180" fontSize="12" fill={C} fontFamily="Georgia, serif">F = ma</text>

          {/* Date 1789 offset semi-transparent */}
          <text x="390" y="192" fontSize="10" fill={C} fontFamily="Georgia, serif" opacity="0.55">1789</text>

          {/* ── ROW D (y ≈ 235–288) ── */}

          {/* Livre ouvert D — incliné -5° */}
          <g transform="translate(8,240) rotate(-5)">
            <rect x="0" y="0" width="16" height="21" rx="1" fill="none" stroke={C} strokeWidth="1.4" />
            <rect x="17" y="0" width="16" height="21" rx="1" fill="none" stroke={C} strokeWidth="1.4" />
            <line x1="16.5" y1="0" x2="16.5" y2="21" stroke={C} strokeWidth="1.4" />
          </g>

          {/* y = ax + b */}
          <text x="44"  y="258" fontSize="13" fill={C} fontFamily="Georgia, serif">y = ax + b</text>

          {/* x² */}
          <text x="160" y="258" fontSize="15" fill={C} fontFamily="Georgia, serif" fontStyle="italic">x²</text>

          {/* Feuille D3 — inclinée -22° */}
          <g transform="translate(192,238) rotate(-22)">
            <path d="M 0,12 C 4,-1 18,-1 18,12 C 18,25 4,25 0,12 Z" fill="none" stroke={C} strokeWidth="1.3" />
            <line x1="0" y1="12" x2="18" y2="12" stroke={C} strokeWidth="0.85" />
          </g>

          {/* Crayon D — incliné -32° */}
          <g transform="translate(234,240) rotate(-32)">
            <rect x="0" y="-4" width="32" height="8" rx="1.5" fill={C} />
            <polygon points="32,-4 40,0 32,4" fill={C} />
            <rect x="0" y="-4" width="6" height="8" rx="1" fill={C} opacity="0.4" />
          </g>

          {/* Date 1914 offset */}
          <text x="282" y="260" fontSize="11" fill={C} fontFamily="Georgia, serif" opacity="0.65">1914</text>

          {/* θ symbole */}
          <text x="326" y="262" fontSize="16" fill={C} fontFamily="Georgia, serif">θ</text>

          {/* λ symbole */}
          <text x="354" y="262" fontSize="14" fill={C} fontFamily="Georgia, serif">λ</text>

          {/* ∑ somme */}
          <text x="382" y="262" fontSize="16" fill={C} fontFamily="Georgia, serif">∑</text>

        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#light-edu-pattern)" />
    </svg>
  );
}
