import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { TimezoneSync } from "./timezone-sync";

async function UserMenu() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex items-center gap-4 text-sm">
      {profile?.timezone === "UTC" && <TimezoneSync />}
      <span>Signed in as {user.email}</span>
      <form action={signOut}>
        <button type="submit" className="underline">
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <nav className="flex items-center gap-4">
          <span className="font-semibold">Todo</span>
          <Link href="/todos" className="text-sm hover:underline">
            Todos
          </Link>
          <Link href="/areas" className="text-sm hover:underline">
            Intentions
          </Link>
          <Link href="/review" className="text-sm hover:underline">
            Review
          </Link>
        </nav>
        <Suspense>
          <UserMenu />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">{children}</main>
    </>
  );
}
