import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadToday, loadTodoOptions, selectTodos } from "@/lib/todos";
import { AreaChip } from "../area-chip";
import { TodoItem, type Todo } from "../_todos/todo-item";
import { createProject } from "./actions";
import { ProjectForm } from "./project-form";
import { ProjectHeader } from "./project-header";

type ListProps = {
  todos: Todo[];
  options: Awaited<ReturnType<typeof loadTodoOptions>>;
  today: string;
  hideProject?: boolean;
};

function TodoList({ todos, options, today, hideProject }: ListProps) {
  return (
    <ul className="divide-y divide-gray-200">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          {...options}
          today={today}
          hideProject={hideProject}
        />
      ))}
    </ul>
  );
}

async function PlanSections() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.rpc("ensure_habit_todos");

  const [open, projects, areas, options, { today }] = await Promise.all([
    selectTodos(supabase)
      .is("completed_at", null)
      .order("starred", { ascending: false })
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, description, archived_at")
      .order("name"),
    supabase
      .from("areas")
      .select("id, name, color, parent_id")
      .is("archived_at", null)
      .order("name"),
    loadTodoOptions(supabase),
    loadToday(supabase, user.id),
  ]);

  if (open.error || projects.error || areas.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your plan. Try reloading.
      </p>
    );
  }

  const todos = open.data;
  const list = { options, today };

  // Deadlines: every dated task, soonest first, wherever else it's listed.
  const dated = todos
    .filter((todo) => todo.due_on !== null)
    .toSorted((a, b) => a.due_on!.localeCompare(b.due_on!));

  // Projects: each task under its project.
  const byProject = Map.groupBy(
    todos.filter((todo) => todo.project_id !== null),
    (todo) => todo.project_id!,
  );
  const activeProjects = projects.data.filter((p) => p.archived_at === null);
  const archivedProjects = projects.data.filter((p) => p.archived_at !== null);

  // Categories: tasks outside a project, under each category they're in.
  // Top-level categories are sections; subcategories are groups inside.
  const unprojected = todos.filter((todo) => todo.project_id === null);
  const inArea = (areaId: string) =>
    unprojected.filter((todo) => todo.areas.some((a) => a.id === areaId));
  const activeAreaIds = new Set(areas.data.map((area) => area.id));
  const topLevel = areas.data.filter(
    (area) => !area.parent_id || !activeAreaIds.has(area.parent_id),
  );
  const childrenOf = Map.groupBy(
    areas.data.filter(
      (area) => area.parent_id && activeAreaIds.has(area.parent_id),
    ),
    (area) => area.parent_id!,
  );
  const categorySections = topLevel
    .map((area) => ({
      area,
      own: inArea(area.id),
      children: (childrenOf.get(area.id) ?? [])
        .map((child) => ({ area: child, todos: inArea(child.id) }))
        .filter((child) => child.todos.length > 0),
    }))
    .filter((section) => section.own.length > 0 || section.children.length > 0);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Deadlines ({dated.length})</h2>
        {dated.length === 0 ? (
          <p className="text-sm text-gray-500">No open tasks have a due date.</p>
        ) : (
          <TodoList todos={dated} {...list} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Projects</h2>
        {activeProjects.length === 0 && (
          <p className="text-sm text-gray-500">
            No projects yet. A project is the parent of the tasks that finish
            it.
          </p>
        )}
        {activeProjects.map((project) => {
          const projectTodos = byProject.get(project.id) ?? [];
          return (
            <div
              key={project.id}
              id={`project-${project.id}`}
              className="flex scroll-mt-4 flex-col gap-1 rounded border border-gray-200 p-3"
            >
              <ProjectHeader project={project} openCount={projectTodos.length} />
              {projectTodos.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No open tasks. Pick this project in a task&apos;s edit form
                  to add one.
                </p>
              ) : (
                <TodoList todos={projectTodos} {...list} hideProject />
              )}
            </div>
          );
        })}
        <details className="flex flex-col gap-3 rounded border border-gray-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            New project
          </summary>
          <div className="pt-3">
            <ProjectForm action={createProject} submitLabel="Create" />
          </div>
        </details>
        {archivedProjects.length > 0 && (
          <details className="flex flex-col gap-1">
            <summary className="cursor-pointer text-sm font-medium">
              Archived projects ({archivedProjects.length})
            </summary>
            <ul className="divide-y divide-gray-200">
              {archivedProjects.map((project) => (
                <li key={project.id} className="py-2">
                  <ProjectHeader project={project} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Categories</h2>
          <Link href="/categories" className="text-sm underline">
            Manage categories
          </Link>
        </div>
        {categorySections.length === 0 && (
          <p className="text-sm text-gray-500">
            No open tasks outside a project have a category.
          </p>
        )}
        {categorySections.map(({ area, own, children }) => (
          <div
            key={area.id}
            className="flex flex-col gap-2 rounded border border-gray-200 p-3"
          >
            <div>
              <AreaChip area={area} />
            </div>
            {own.length > 0 && <TodoList todos={own} {...list} />}
            {children.map((child) => (
              <div key={child.area.id} className="ml-4 flex flex-col gap-1">
                <div>
                  <AreaChip area={child.area} />
                </div>
                <TodoList todos={child.todos} {...list} />
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}

export default function PlanPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Plan</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <PlanSections />
      </Suspense>
    </div>
  );
}
