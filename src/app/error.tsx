"use client";
import { SystemState } from "@/components/system/system-state";
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <SystemState kind="unexpected" reference={error.digest} retry={retry} />
  );
}
