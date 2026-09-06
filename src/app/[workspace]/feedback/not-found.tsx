import Link from "next/link";
export default function FeedbackNotFound() {
  return (
    <main className="mx-auto grid max-w-2xl gap-5 px-5 py-20">
      <h1 className="font-serif text-3xl">That feedback could not be found.</h1>
      <p className="text-muted">
        It may have moved, or the link may be incomplete.
      </p>
      <Link href="/" className="w-fit py-2 underline">
        Back to home
      </Link>
    </main>
  );
}
