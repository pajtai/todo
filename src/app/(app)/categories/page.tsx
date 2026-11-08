import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createArea } from "./actions";
import { AreaForm } from "./area-form";
import { AreaRow } from "./area-row";

async function AreaLists() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: areas, error } = await supabase
    .from("areas")
    .select("id, name, color, description, archived_at")
    .order("name");

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your categories. Try reloading.
      </p>
    );
  }

  const active = areas.filter((area) => area.archived_at === null);
  const archived = areas.filter((area) => area.archived_at !== null);

  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-gray-200 p-4">
        <h2 className="font-medium">New</h2>
        <AreaForm action={createArea} submitLabel="Create" />
      </section>
      {areas.length === 0 && (
        <p className="text-gray-500">
          Nothing yet. Create a category, such as a goal or habit,
          to group your todos.
        </p>
      )}
      {active.length > 0 && (
        <ul className="divide-y divide-gray-200">
          {active.map((area) => (
            <AreaRow key={area.id} area={area} />
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="flex flex-col gap-1">
          <summary className="cursor-pointer font-medium">
            Archived ({archived.length})
          </summary>
          <ul className="divide-y divide-gray-200">
            {archived.map((area) => (
              <AreaRow key={area.id} area={area} />
            ))}
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
