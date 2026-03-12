export default function BackgroundPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.05] md:opacity-[0.06]"
    >
      <svg className="h-full w-full" viewBox="0 0 1200 900" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="edu-pattern" width="220" height="180" patternUnits="userSpaceOnUse">
            <text x="16" y="28" fontSize="16" fill="currentColor">✏️</text>
            <text x="58" y="30" fontSize="14" fill="currentColor">📘</text>
            <text x="98" y="26" fontSize="14" fill="currentColor">π</text>
            <text x="136" y="28" fontSize="13" fill="currentColor">E = mc²</text>
            <text x="16" y="66" fontSize="12" fill="currentColor">1789</text>
            <text x="62" y="66" fontSize="12" fill="currentColor">1914</text>
            <text x="108" y="66" fontSize="12" fill="currentColor">1945</text>
            <text x="154" y="66" fontSize="12" fill="currentColor">1969</text>
            <text x="20" y="98" fontSize="12" fill="currentColor">a² + b² = c²</text>
            <text x="122" y="98" fontSize="14" fill="currentColor">📄</text>
            <text x="20" y="132" fontSize="11" fill="currentColor">"Apprendre avec confiance"</text>
            <text x="24" y="160" fontSize="14" fill="currentColor">📚</text>
            <text x="68" y="160" fontSize="14" fill="currentColor">🖊️</text>
          </pattern>
        </defs>
        <rect width="1200" height="900" fill="url(#edu-pattern)" className="text-slate-500" />
      </svg>
    </div>
  );
}
