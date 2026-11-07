import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isUuid } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { selectActiveAreas, selectTodos } from "@/lib/todos";
import { AreaChip } from "../../area-chip";
import { TodoItem } from "../../todos/todo-item";
import { RepeatingStats } from "./repeating-stats";

const COMPLETED_LIMIT = 50;

async function AreaDetail({
  params,
}: {
  params: PageProps<"/areas/[id]">["params"];
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  await getCurrentUser();
  const supabase = await createClient();
  const { data: area } = await supabase
    .from("areas")
    .select("id, name, description, archived_at, parent_id")
    .eq("id", id)
    .maybeSingle();

  if (!area) {
    notFound();
  }

  const [parent, children, open, completed, options] = await Promise.all([
    area.parent_id
      ? supabase
          .from("areas")
          .select("id, name, color")
          .eq("id", area.parent_id)
          .maybeSingle()
      : null,
    supabase
      .from("areas")
      .select("id, name, color")
      .eq("parent_id", id)
      .is("archived_at", null)
      .order("name"),
    selectTodos(supabase, id)
      .is("completed_at", null)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    selectTodos(supabase, id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(COMPLETED_LIMIT),
    selectActiveAreas(supabase),
  ]);

  if (open.error || completed.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load this category. Try reloading.
      </p>
    );
  }

  const areaOptions = options.data ?? [];

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/areas" className="text-sm text-gray-500 underline">
          All categories
        </Link>
        <h1 className="text-2xl font-semibold">{area.name}</h1>
        {area.archived_at && (
          <p className="text-sm text-gray-500">Archived</p>
        )}
        <Link
          href={`/review?area=${area.id}`}
          className="text-sm underline"
        >
          Review completed todos, including subcategories
        </Link>
        {area.description && (
          <p className="whitespace-pre-wrap">{area.description}</p>
        )}
      </div>
      {parent?.data && (
        <div className="flex items-center gap-2 text-sm">
          Part of <AreaChip area={parent.data} />
        </div>
      )}
      {children.data && children.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Includes
          {children.data.map((child) => (
            <AreaChip key={child.id} area={child} />
          ))}
        </div>
      )}
      <RepeatingStats supabase={supabase} areaId={area.id} />
      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Open ({open.data.length})</h2>
        <ul className="divide-y divide-gray-200">
          {open.data.map((todo) => (
            <TodoItem key={todo.id} todo={todo} areaOptions={areaOptions} />
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Completed ({completed.data.length})</h2>
        <ul className="divide-y divide-gray-200">
          {completed.data.map((todo) => (
            <TodoItem key={todo.id} todo={todo} areaOptions={areaOptions} />
          ))}
        </ul>
      </section>
    </>
  );
}

export default function AreaPage({ params }: PageProps<"/areas/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <AreaDetail params={params} />
      </Suspense>
    </div>
  );
}
