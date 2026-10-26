"use client";

import { AppError } from "@/components/AppError";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <AppError {...props} />
      </body>
    </html>
  );
}
