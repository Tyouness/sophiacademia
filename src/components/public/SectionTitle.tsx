/**
 * SectionTitle
 *
 * H2 avec signature visuelle :
 * - Texte Fraunces bold
 * - Ligne dorée 40px × 3px sous le titre (signature Sophiacademia)
 * - Eyebrow optionnel en ambre
 *
 * Usage :
 *   <SectionTitle eyebrow="Nos professeurs">
 *     Des profils d'exception
 *   </SectionTitle>
 */

interface SectionTitleProps {
  eyebrow?: string;
  children: React.ReactNode;
  light?: boolean; // true = texte blanc (sections sombres)
  center?: boolean;
}

export default function SectionTitle({
  eyebrow,
  children,
  light = false,
  center = false,
}: SectionTitleProps) {
  return (
    <div className={center ? "text-center" : ""}>
      {eyebrow && (
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#F59E0B" }}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className="text-3xl font-bold md:text-4xl"
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          color: light ? "#FFFFFF" : "#0F172A",
        }}
      >
        {children}
      </h2>
      {/* Signature ligne dorée */}
      <div
        className={`mt-3 h-[3px] w-10 rounded-full ${center ? "mx-auto" : ""} gold-line-animate`}
        style={{ backgroundColor: "#F59E0B" }}
        aria-hidden
      />
    </div>
  );
}
