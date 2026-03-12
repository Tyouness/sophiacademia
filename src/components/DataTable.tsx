import type { ReactNode } from "react";

type Column = {
  key: string;
  label: string;
  className?: string;
  headerClassName?: string;
};

type DataTableProps = {
  columns: Column[];
  rows: Array<Record<string, ReactNode>>;
  emptyLabel?: string;
};

export default function DataTable({
  columns,
  rows,
  emptyLabel = "Aucune donnee",
}: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-md">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.25em] text-gray-500">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`border-b border-blue-100 px-4 py-3 ${
                  column.headerClassName ?? ""
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-sm text-gray-500"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-b border-blue-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-gray-700 ${
                      column.className ?? ""
                    }`}
                  >
                    {row[column.key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
