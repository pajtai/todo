"use client";

import { useRouter } from "next/navigation";

type AreaSelectProps = {
  areas: { id: string; name: string; archived: boolean }[];
  selected?: string;
  /** Link for each option, keyed by area id, plus "" for "All categories". */
  hrefs: Record<string, string>;
};

// Navigates on change, so the filter stays a plain linkable URL.
export function AreaSelect({ areas, selected, hrefs }: AreaSelectProps) {
  const router = useRouter();
  const active = areas.filter((area) => !area.archived);
  const archived = areas.filter((area) => area.archived);

  return (
    <label className="flex items-center gap-2 text-sm">
      Category
      <select
        value={selected ?? ""}
        onChange={(event) => router.push(hrefs[event.target.value])}
        className="rounded border border-gray-300 px-2 py-1 text-black"
      >
        <option value="">All categories</option>
        {active.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
        {archived.length > 0 && (
          <optgroup label="Archived">
            {archived.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
