"use client";

import { useRouter } from "next/navigation";
import { AREA_TYPE_LABELS, AREA_TYPES, type AreaType } from "@/lib/areas";

type AreaSelectProps = {
  areas: { id: string; name: string; type: AreaType; archived: boolean }[];
  selected?: string;
  /** Link for each option, keyed by area id, plus "" for "All areas". */
  hrefs: Record<string, string>;
};

// Navigates on change, so the filter stays a plain linkable URL.
export function AreaSelect({ areas, selected, hrefs }: AreaSelectProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      Area
      <select
        value={selected ?? ""}
        onChange={(event) => router.push(hrefs[event.target.value])}
        className="rounded border border-gray-300 px-2 py-1 text-black"
      >
        <option value="">All areas</option>
        {AREA_TYPES.map((type) => {
          const ofType = areas.filter((area) => area.type === type);
          return (
            ofType.length > 0 && (
              <optgroup key={type} label={AREA_TYPE_LABELS[type]}>
                {ofType.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                    {area.archived ? " (archived)" : ""}
                  </option>
                ))}
              </optgroup>
            )
          );
        })}
      </select>
    </label>
  );
}
