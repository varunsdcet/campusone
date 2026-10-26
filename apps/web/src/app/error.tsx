"use client";

import { AppError } from "@/components/AppError";

export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppError {...props} />;
}
