"use client";

import { useEffect } from "react";

/** Last-resort boundary: replaces the root layout, so it renders its own <html>/<body>. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <main
          role="alert"
          style={{ minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}
        >
          <h1 style={{ fontSize: 20, margin: 0 }}>تعذّر تحميل الصفحة / This page could not be loaded</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>حدث خطأ مؤقت. جرّب مرة أخرى. / A temporary problem occurred. Please try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#111", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            إعادة المحاولة / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
