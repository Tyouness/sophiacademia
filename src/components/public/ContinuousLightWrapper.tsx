/**
 * ContinuousLightWrapper — v3
 *
 * Architecture corrigée.
 *
 * PROBLÈME v1/v2 :
 *   Un div absolu (z:0) avec background-image DERRIÈRE des sections
 *   avec background-color est invisible.
 *   Math : opacity CSS (0.07) × transparence section (6%) = 0.42% → invisible.
 *
 * SOLUTION CORRECTE :
 *   Appliquer background-image DIRECTEMENT sur chaque section via `patternBgStyle`.
 *   CSS rend background-image PAR-DESSUS background-color sur le même élément.
 *   L'opacité est encodée dans le SVG lui-même via opacity="0.12" (debug).
 *   → Pour la production, passer opacity="0.07" dans le <g> wrapper du SVG.
 *
 * USAGE dans page.tsx :
 *   import ContinuousLightWrapper, { patternBgStyle } from "…/ContinuousLightWrapper";
 *   <section style={{ backgroundColor: "#FFFFFF", ...patternBgStyle }}>
 */

// Couleur base brand-royal
const BRAND = "#1E3A5F";

/**
 * Construit le SVG de la tuile et le retourne encodé pour background-image.
 * Exécuté une seule fois au module-level → aucun coût runtime client.
 */
function buildPatternDataUri(): string {
  // Toutes les formes dans <g opacity="0.07">
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300">
<g opacity="0.07">

<!-- Crayon 1 -18deg -->
<g transform="translate(16,18) rotate(-18)">
<rect x="0" y="-5" width="36" height="10" rx="1.5" fill="${BRAND}"/>
<polygon points="36,-5 46,0 36,5" fill="${BRAND}"/>
<rect x="0" y="-5" width="7" height="10" rx="1" fill="${BRAND}" opacity="0.45"/>
</g>

<!-- 1789 -->
<text x="74" y="24" font-size="13" fill="${BRAND}" font-family="Georgia,serif" font-weight="600">1789</text>

<!-- Livre ouvert A -->
<g transform="translate(134,6)">
<rect x="0" y="0" width="17" height="23" rx="1" fill="none" stroke="${BRAND}" stroke-width="1.6"/>
<rect x="19" y="0" width="17" height="23" rx="1" fill="none" stroke="${BRAND}" stroke-width="1.6"/>
<line x1="18" y1="0" x2="18" y2="23" stroke="${BRAND}" stroke-width="1.6"/>
<line x1="2" y1="7" x2="15" y2="7" stroke="${BRAND}" stroke-width="1"/>
<line x1="2" y1="12" x2="15" y2="12" stroke="${BRAND}" stroke-width="1"/>
<line x1="2" y1="17" x2="15" y2="17" stroke="${BRAND}" stroke-width="1"/>
<line x1="21" y1="7" x2="34" y2="7" stroke="${BRAND}" stroke-width="1"/>
<line x1="21" y1="12" x2="34" y2="12" stroke="${BRAND}" stroke-width="1"/>
</g>

<!-- ∫ -->
<text x="178" y="32" font-size="30" fill="${BRAND}" font-family="Georgia,serif">∫</text>

<!-- E=mc² -->
<text x="213" y="26" font-size="12" fill="${BRAND}" font-family="Georgia,serif">E = mc²</text>

<!-- 1914 -->
<text x="290" y="22" font-size="13" fill="${BRAND}" font-family="Georgia,serif" font-weight="600">1914</text>

<!-- Stylo A 20deg -->
<g transform="translate(348,8) rotate(20)">
<ellipse cx="17" cy="0" rx="17" ry="4.5" fill="${BRAND}"/>
<polygon points="32,-4.5 43,0 32,4.5" fill="${BRAND}"/>
<rect x="0" y="-4.5" width="7" height="9" rx="1" fill="${BRAND}" opacity="0.4"/>
</g>

<!-- 1945 -->
<text x="390" y="52" font-size="11" fill="${BRAND}" font-family="Georgia,serif" opacity="0.7">1945</text>

<!-- Feuille B -35deg -->
<g transform="translate(10,88) rotate(-35)">
<path d="M0,13 C5,-3 22,-3 22,13 C22,29 5,29 0,13Z" fill="none" stroke="${BRAND}" stroke-width="1.5"/>
<line x1="0" y1="13" x2="22" y2="13" stroke="${BRAND}" stroke-width="1"/>
<line x1="11" y1="1" x2="11" y2="25" stroke="${BRAND}" stroke-width="0.9"/>
</g>

<!-- Apprendre citation -->
<text x="48" y="98" font-size="10" fill="${BRAND}" font-family="Georgia,serif" font-style="italic">&#171; Apprendre, c&#39;est d&#233;couvrir &#187;</text>

<!-- √x²=|x| -->
<text x="48" y="116" font-size="13" fill="${BRAND}" font-family="Georgia,serif">&#x221A;x&#xB2; = |x|</text>

<!-- 1969 -->
<text x="200" y="112" font-size="13" fill="${BRAND}" font-family="Georgia,serif" font-weight="600">1969</text>

<!-- Livre fermé B 4deg -->
<g transform="translate(264,76) rotate(4)">
<rect x="0" y="0" width="32" height="38" rx="2" fill="none" stroke="${BRAND}" stroke-width="1.6"/>
<rect x="3" y="0" width="5" height="38" rx="1" fill="${BRAND}" opacity="0.2"/>
<line x1="8" y1="10" x2="29" y2="10" stroke="${BRAND}" stroke-width="1"/>
<line x1="8" y1="16" x2="29" y2="16" stroke="${BRAND}" stroke-width="1"/>
<line x1="8" y1="22" x2="29" y2="22" stroke="${BRAND}" stroke-width="1"/>
<line x1="8" y1="28" x2="29" y2="28" stroke="${BRAND}" stroke-width="1"/>
</g>

<!-- π≈3.14 -->
<text x="316" y="112" font-size="12" fill="${BRAND}" font-family="Georgia,serif">&#x3C0; &#x2248; 3.14</text>

<!-- ✎ glyphe -->
<text x="368" y="106" font-size="19" fill="${BRAND}" font-family="sans-serif" opacity="0.8">&#x270E;</text>

<!-- Crayon C 10deg -->
<g transform="translate(6,168) rotate(10)">
<rect x="0" y="-5" width="40" height="10" rx="1.5" fill="${BRAND}"/>
<polygon points="40,-5 50,0 40,5" fill="${BRAND}"/>
<rect x="0" y="-5" width="8" height="10" rx="1" fill="${BRAND}" opacity="0.4"/>
</g>

<!-- a²+b²=c² -->
<text x="62" y="178" font-size="12" fill="${BRAND}" font-family="Georgia,serif">a&#xB2; + b&#xB2; = c&#xB2;</text>

<!-- Δy/Δx -->
<text x="190" y="178" font-size="12" fill="${BRAND}" font-family="Georgia,serif">&#x394;y / &#x394;x</text>

<!-- Feuille C2 45deg -->
<g transform="translate(248,162) rotate(45)">
<path d="M0,11 C4,-2 18,-2 18,11 C18,24 4,24 0,11Z" fill="none" stroke="${BRAND}" stroke-width="1.4"/>
<line x1="0" y1="11" x2="18" y2="11" stroke="${BRAND}" stroke-width="0.9"/>
<line x1="9" y1="1" x2="9" y2="21" stroke="${BRAND}" stroke-width="0.8"/>
</g>

<!-- Stylo C -28deg -->
<g transform="translate(288,164) rotate(-28)">
<ellipse cx="16" cy="0" rx="16" ry="4" fill="${BRAND}"/>
<polygon points="30,-4 40,0 30,4" fill="${BRAND}"/>
</g>

<!-- F=ma -->
<text x="344" y="180" font-size="12" fill="${BRAND}" font-family="Georgia,serif">F = ma</text>

<!-- 1789 offset -->
<text x="390" y="192" font-size="10" fill="${BRAND}" font-family="Georgia,serif" opacity="0.55">1789</text>

<!-- Livre ouvert D -5deg -->
<g transform="translate(8,240) rotate(-5)">
<rect x="0" y="0" width="16" height="21" rx="1" fill="none" stroke="${BRAND}" stroke-width="1.4"/>
<rect x="17" y="0" width="16" height="21" rx="1" fill="none" stroke="${BRAND}" stroke-width="1.4"/>
<line x1="16.5" y1="0" x2="16.5" y2="21" stroke="${BRAND}" stroke-width="1.4"/>
</g>

<!-- y=ax+b -->
<text x="44" y="258" font-size="13" fill="${BRAND}" font-family="Georgia,serif">y = ax + b</text>

<!-- x² isolé -->
<text x="160" y="258" font-size="15" fill="${BRAND}" font-family="Georgia,serif" font-style="italic">x&#xB2;</text>

<!-- Feuille D -22deg -->
<g transform="translate(192,238) rotate(-22)">
<path d="M0,12 C4,-1 18,-1 18,12 C18,25 4,25 0,12Z" fill="none" stroke="${BRAND}" stroke-width="1.3"/>
<line x1="0" y1="12" x2="18" y2="12" stroke="${BRAND}" stroke-width="0.85"/>
</g>

<!-- Crayon D -32deg -->
<g transform="translate(234,240) rotate(-32)">
<rect x="0" y="-4" width="32" height="8" rx="1.5" fill="${BRAND}"/>
<polygon points="32,-4 40,0 32,4" fill="${BRAND}"/>
<rect x="0" y="-4" width="6" height="8" rx="1" fill="${BRAND}" opacity="0.4"/>
</g>

<!-- 1914 offset -->
<text x="282" y="260" font-size="11" fill="${BRAND}" font-family="Georgia,serif" opacity="0.65">1914</text>

<!-- θ -->
<text x="326" y="262" font-size="16" fill="${BRAND}" font-family="Georgia,serif">&#x3B8;</text>

<!-- λ -->
<text x="354" y="262" font-size="14" fill="${BRAND}" font-family="Georgia,serif">&#x3BB;</text>

<!-- ∑ -->
<text x="382" y="262" font-size="16" fill="${BRAND}" font-family="Georgia,serif">&#x2211;</text>

</g>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// URI calculée une seule fois au module-level (SSG — aucun coût client)
const PATTERN_DATA_URI = buildPatternDataUri();

/**
 * Styles à appliquer sur chaque section claire.
 * background-image se rend PAR-DESSUS background-color sur le même élément.
 * L'opacité est dans le SVG : opacity="0.12" (debug) → "0.07" (production).
 *
 * Usage :
 *   <section style={{ backgroundColor: "#FFFFFF", ...patternBgStyle }}>
 */
export const patternBgStyle: React.CSSProperties = {
  backgroundImage: `url("${PATTERN_DATA_URI}")`,
  backgroundRepeat: "repeat",
  backgroundSize: "420px 300px",
  backgroundPosition: "top left",
};

interface ContinuousLightWrapperProps {
  children: React.ReactNode;
}

/** Wrapper sémantique pour grouper les sections claires. */
export default function ContinuousLightWrapper({ children }: ContinuousLightWrapperProps) {
  return <div className="relative">{children}</div>;
}
