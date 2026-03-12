type TopBarProps = {
  title: string;
  userName?: string | null;
  userEmail?: string | null;
  roleLabel?: string | null;
};

export default function TopBar({
  title,
  userName,
  userEmail,
  roleLabel,
}: TopBarProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-blue-100 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between px-8 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-500">
            Tableau de bord
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 [font-family:var(--font-display)]">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="font-semibold text-gray-900">
              {userName || "Utilisateur"}
            </p>
            <p className="text-xs text-gray-500">
              {userEmail || roleLabel}
            </p>
          </div>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-blue-600 hover:bg-blue-50"
            >
              Deconnexion
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
