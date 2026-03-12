type StatCardProps = {
  label: string;
  value: string | number;
  helper?: string;
};

export default function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-md">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold text-gray-900 [font-family:var(--font-display)]">
        {value}
      </p>
      {helper ? (
        <p className="mt-2 text-xs text-gray-500">{helper}</p>
      ) : null}
    </div>
  );
}
