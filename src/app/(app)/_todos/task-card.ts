// Plain module (not "use client") so server pages can read these strings;
// exports from a client module reach server components as references.

/** A task's card: a lightly filled, slightly rounded box. */
export const TASK_CARD_CLASS =
  "rounded-lg border border-gray-200 bg-gray-50 px-3";

/** A list of task cards, spaced apart instead of divided by lines. */
export const TASK_LIST_CLASS = "flex flex-col gap-2";
