import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nextOccurrence } from "@/lib/habits";
import {
  loadToday,
  loadTodoOptions,
  selectSeriesWithLatest,
  selectTodos,
} from "@/lib/todos";
import { AreaChip } from "../area-chip";
import { TASK_LIST_CLASS } from "../_todos/task-card";
import { TodoItem, type Todo } from "../_todos/todo-item";
import { ProjectHeader } from "./project-header";
import { ProjectQuickAdd } from "./project-quick-add";
import { SectionHeader } from "./section-header";

/** A Plan task: an open todo, or a repeating task's next occurrence. */
type PlanTodo = Todo & {
  project_id: string | null;
  created_at: string;
  occurrence_date: string | null;
  /** Set for a repeating task with no open todo: when the next one appears. */
  upcomingOn?: string;
};

// The day a repeating todo is scheduled for, if it still repeats.
function occursOn(todo: PlanTodo) {
  return todo.series && !todo.series.ended_on ? todo.occurrence_date : null;
}

// An open repeating todo scheduled after today, e.g. a weekly task whose
// start date is still ahead, shows "Next" and that date.
function nextOn(todo: PlanTodo, today: string) {
  const date = occursOn(todo);
  return date && date > today ? date : undefined;
}

type ListProps = {
  todos: PlanTodo[];
  options: Awaited<ReturnType<typeof loadTodoOptions>>;
  today: string;
  hideProject?: boolean;
  hideAreaId?: string;
  convertible?: boolean;
};

function TodoList({
  todos,
  options,
  today,
  hideProject,
  hideAreaId,
  convertible,
}: ListProps) {
  return (
    <ul className={TASK_LIST_CLASS}>
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          {...options}
          today={today}
          upcomingOn={todo.upcomingOn}
          nextOn={nextOn(todo, today)}
          hideProject={hideProject}
          hideAreaId={hideAreaId}
          convertible={convertible}
        />
      ))}
    </ul>
  );
}

async function PlanSections() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.rpc("ensure_habit_todos");

  const [open, series, projects, areas, options, { today }] = await Promise.all([
    selectTodos(supabase)
      .is("completed_at", null)
      .order("starred", { ascending: false })
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    selectSeriesWithLatest(supabase),
    supabase
      .from("projects")
      .select("id, name, description, archived_at")
      .order("name"),
    supabase
      .from("areas")
      .select("id, name, color")
      .is("archived_at", null)
      .order("name"),
    loadTodoOptions(supabase),
    loadToday(supabase, user.id),
  ]);

  if (open.error || series.error || projects.error || areas.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your plan. Try reloading.
      </p>
    );
  }

  // A repeating task with no open todo (just completed, or not due today)
  // still belongs on Plan: its latest todo stands in for the next occurrence,
  // which copies that todo's title, project and categories.
  const openSeries = new Set(open.data.map((todo) => todo.series?.id));
  const upcoming: PlanTodo[] = series.data.flatMap(({ todos: [latest], ...rule }) => {
    const upcomingOn = nextOccurrence(rule, today);
    if (!latest || openSeries.has(rule.id) || !upcomingOn) return [];
    return [{ ...latest, series: rule, upcomingOn }];
  });
  // Open todos keep their order; upcoming ones follow, soonest first.
  const todos: PlanTodo[] = [
    ...open.data,
    ...upcoming.toSorted((a, b) => a.upcomingOn!.localeCompare(b.upcomingOn!)),
  ];
  const list = { options, today };

  // Deadlines: every dated task, and every repeating task by the day of its
  // open or next occurrence, soonest first, wherever else it's listed.
  const deadline = (todo: PlanTodo) =>
    todo.upcomingOn ?? todo.due_on ?? occursOn(todo);
  const dated = todos
    .filter((todo) => deadline(todo) !== null)
    .toSorted((a, b) => deadline(a)!.localeCompare(deadline(b)!));

  // Projects: each task under its project.
  const byProject = Map.groupBy(
    todos.filter((todo) => todo.project_id !== null),
    (todo) => todo.project_id!,
  );
  const activeProjects = projects.data.filter((p) => p.archived_at === null);
  const archivedProjects = projects.data.filter((p) => p.archived_at !== null);

  // Categories: tasks outside a project, under each category they're in.
  const unprojected = todos.filter((todo) => todo.project_id === null);
  const categorySections = areas.data
    .map((area) => ({
      area,
      todos: unprojected.filter((todo) =>
        todo.areas.some((a) => a.id === area.id),
      ),
    }))
    .filter((section) => section.todos.length > 0);

  // Inbox: the same rule as Capture — no project, category, due date, or
  // repeat — newest first.
  const inbox = todos
    .filter(
      (todo) =>
        todo.project_id === null &&
        todo.due_on === null &&
        todo.series === null &&
        todo.areas.length === 0,
    )
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Deadlines ({dated.length})</h2>
        {dated.length === 0 ? (
          <p className="text-sm text-gray-500">
            No open tasks have a due date, and nothing repeats.
          </p>
        ) : (
          <TodoList todos={dated} {...list} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Projects" creates="project" />
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
              <ProjectHeader
                project={project}
                openCount={projectTodos.filter((todo) => !todo.upcomingOn).length}
              />
              {projectTodos.length === 0 ? (
                <>
                  <p className="text-sm text-gray-500">
                    No open tasks. Pick this project in a task&apos;s edit form
                    to add one.
                  </p>
                  <ProjectQuickAdd projectId={project.id} />
                </>
              ) : (
                <TodoList todos={projectTodos} {...list} hideProject />
              )}
            </div>
          );
        })}
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
        <SectionHeader
          title="Categories"
          creates="category"
          aside={
            <Link href="/categories" className="text-sm underline">
              Manage categories
            </Link>
          }
        />
        {categorySections.length === 0 && (
          <p className="text-sm text-gray-500">
            No open tasks outside a project have a category.
          </p>
        )}
        {categorySections.map(({ area, todos }) => (
          <div
            key={area.id}
            className="flex flex-col gap-2 rounded border border-gray-200 p-3"
          >
            <div>
              <AreaChip area={area} />
            </div>
            <TodoList todos={todos} {...list} hideAreaId={area.id} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Inbox ({inbox.length})</h2>
        {inbox.length === 0 ? (
          <p className="text-sm text-gray-500">
            Inbox zero. Everything has a project, category, or due date.
          </p>
        ) : (
          <TodoList todos={inbox} {...list} convertible />
        )}
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
