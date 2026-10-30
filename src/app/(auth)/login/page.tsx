import { Suspense } from "react";
import { signIn } from "../actions";
import { AuthForm } from "../auth-form";

async function ConfirmNotice({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { confirm } = await searchParams;
  if (confirm !== "failed") {
    return null;
  }
  return (
    <p role="alert" className="text-red-600">
      We couldn&apos;t confirm you from that link. It may have expired, or been
      opened in a different browser. Try logging in.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <Suspense>
        <ConfirmNotice searchParams={searchParams} />
      </Suspense>
      <AuthForm action={signIn} mode="login" />
    </>
  );
}
