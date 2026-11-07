import { Suspense } from "react";
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
    .select("id, name, color, parent_id, description, archived_at")
    .order("name");

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your categories. Try reloading.
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

  // Active categories in tree order, each followed by its children. A child
  // of an archived category is shown at the top level.
  const activeIds = new Set(active.map((area) => area.id));
  const childrenOf = Map.groupBy(active, (area) =>
    area.parent_id && activeIds.has(area.parent_id) ? area.parent_id : null,
  );
  const tree: { area: (typeof areas)[number]; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const area of childrenOf.get(parentId) ?? []) {
      tree.push({ area, depth });
      visit(area.id, depth + 1);
    }
  };
  visit(null, 0);

  // Nested rows are indented under their parent, so only top-level rows
  // need to name one.
  const row = (area: (typeof areas)[number], depth = 0) => (
    <AreaRow
      key={area.id}
      area={area}
      depth={depth}
      parentName={
        depth === 0 && area.parent_id
          ? namesById.get(area.parent_id)
          : undefined
      }
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
          Nothing yet. Create a category, such as a project, goal, or habit,
          to group your todos.
        </p>
      )}
      {active.length > 0 && (
        <ul className="divide-y divide-gray-200">
          {tree.map(({ area, depth }) => row(area, depth))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="flex flex-col gap-1">
          <summary className="cursor-pointer font-medium">
            Archived ({archived.length})
          </summary>
          <ul className="divide-y divide-gray-200">
            {archived.map((area) => row(area))}
          </ul>
        </details>
      )}
    </>
  );
}

export default function AreasPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <AreaLists />
      </Suspense>
    </div>
  );
}
