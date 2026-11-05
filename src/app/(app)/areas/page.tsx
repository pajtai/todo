import { Suspense } from "react";
import { AREA_TYPE_LABELS, AREA_TYPES } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createArea } from "./actions";
import { AreaForm } from "./area-form";
import { AreaRow } from "./area-row";

async function AreaLists() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: areas, error } = await supabase
    .from("areas")
    .select(
      "id, name, type, color, parent_id, description, archived_at, recurrence, recurrence_days, habit_title, starts_on",
    )
    .order("name");

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your areas. Try reloading.
      </p>
    );
  }

  const namesById = new Map(areas.map((area) => [area.id, area.name]));
  const active = areas.filter((area) => area.archived_at === null);
  const archived = areas.filter((area) => area.archived_at !== null);

  // Self is excluded; a parent that's archived stays selectable only for the
  // area already using it, so saving doesn't silently clear it.
  const parentsFor = (area: Pick<Tables<"areas">, "id" | "parent_id">) =>
    areas.filter(
      (parent) =>
        parent.id !== area.id &&
        (parent.archived_at === null || parent.id === area.parent_id),
    );

  const row = (area: (typeof areas)[number]) => (
    <AreaRow
      key={area.id}
      area={area}
      parentName={area.parent_id ? namesById.get(area.parent_id) : undefined}
      parents={parentsFor(area)}
    />
  );

  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-gray-200 p-4">
        <h2 className="font-medium">New</h2>
        <AreaForm action={createArea} parents={active} submitLabel="Create" />
      </section>
      {areas.length === 0 && (
        <p className="text-gray-500">
          Nothing yet. Create a project, goal, or habit to group your todos.
        </p>
      )}
      {AREA_TYPES.map((type) => {
        const ofType = active.filter((area) => area.type === type);
        return (
          ofType.length > 0 && (
            <section key={type} className="flex flex-col gap-1">
              <h2 className="font-medium">{AREA_TYPE_LABELS[type]}</h2>
              <ul className="divide-y divide-gray-200">{ofType.map(row)}</ul>
            </section>
          )
        );
      })}
      {archived.length > 0 && (
        <details className="flex flex-col gap-1">
          <summary className="cursor-pointer font-medium">
            Archived ({archived.length})
          </summary>
          <ul className="divide-y divide-gray-200">{archived.map(row)}</ul>
        </details>
      )}
    </>
  );
}

export default function AreasPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Intentions</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <AreaLists />
      </Suspense>
    </div>
  );
}
