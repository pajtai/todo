import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isUuid } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTodoOptions, selectTodos } from "@/lib/todos";
import { TASK_LIST_CLASS } from "../../_todos/task-card";
import { TodoItem } from "../../_todos/todo-item";
import { RepeatingStats } from "./repeating-stats";

const COMPLETED_LIMIT = 50;

async function AreaDetail({
  params,
}: {
  params: PageProps<"/categories/[id]">["params"];
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  await getCurrentUser();
  const supabase = await createClient();
  const { data: area } = await supabase
    .from("areas")
    .select("id, name, description, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (!area) {
    notFound();
  }

  const [open, completed, options] = await Promise.all([
    selectTodos(supabase, id)
      .is("completed_at", null)
      .order("starred", { ascending: false })
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    selectTodos(supabase, id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(COMPLETED_LIMIT),
    loadTodoOptions(supabase),
  ]);

  if (open.error || completed.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load this category. Try reloading.
      </p>
    );
  }


  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/categories" className="text-sm text-gray-500 underline">
          All categories
        </Link>
        <h1 className="text-2xl font-semibold">{area.name}</h1>
        {area.archived_at && (
          <p className="text-sm text-gray-500">Archived</p>
        )}
        <Link
          href={`/review?category=${area.id}`}
          className="text-sm underline"
        >
          Review completed todos
        </Link>
        {area.description && (
          <p className="whitespace-pre-wrap">{area.description}</p>
        )}
      </div>
      <RepeatingStats supabase={supabase} areaId={area.id} />
      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Open ({open.data.length})</h2>
        <ul className={TASK_LIST_CLASS}>
          {open.data.map((todo) => (
            <TodoItem key={todo.id} todo={todo} {...options} />
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Completed ({completed.data.length})</h2>
        <ul className={TASK_LIST_CLASS}>
          {completed.data.map((todo) => (
            <TodoItem key={todo.id} todo={todo} {...options} />
          ))}
        </ul>
      </section>
    </>
  );
}

export default function AreaPage({ params }: PageProps<"/categories/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <AreaDetail params={params} />
      </Suspense>
    </div>
  );
}
