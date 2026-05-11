"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Top-level error boundary for the whole app shell.
 * Triggered when an error escapes every nested error.tsx (incl. the root layout itself).
 * Must include <html> and <body> because the app's normal layout has not rendered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          backgroundColor: "#FAF6EE",
          color: "#1E1F22",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "28rem",
            backgroundColor: "#FFFFFF",
            borderRadius: "1.5rem",
            padding: "2rem",
            textAlign: "center",
            boxShadow: "0 12px 32px -12px rgba(70, 48, 20, 0.18)",
          }}
        >
          <div
            style={{
              margin: "0 auto",
              width: "3.5rem",
              height: "3.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              backgroundColor: "rgba(216, 100, 61, 0.12)",
              color: "#D8643D",
            }}
          >
            <AlertCircle size={28} />
          </div>

          <h1 style={{ marginTop: "1rem", fontSize: "1.5rem", fontWeight: 700 }}>
            Erreur inattendue
          </h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.95rem", lineHeight: 1.5, color: "#4B4F58" }}>
            Quotidy a rencontré un problème qui empêche d&apos;afficher la page. Vous pouvez essayer
            de recharger ou revenir à l&apos;accueil.
          </p>
          {error.digest ? (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#787C84" }}>
              Référence&nbsp;: {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.25rem",
                borderRadius: "0.75rem",
                border: "none",
                backgroundColor: "#D8643D",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={16} />
              Réessayer
            </button>
            <a
              href="/app"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.75rem 1.25rem",
                borderRadius: "0.75rem",
                border: "1px solid rgba(30, 31, 34, 0.08)",
                backgroundColor: "transparent",
                color: "#1E1F22",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Retour à l&apos;accueil
            </a>
            <a
              href={`/app/settings?report=1${error.digest ? `&digest=${encodeURIComponent(error.digest)}` : ""}`}
              style={{
                marginTop: "0.25rem",
                fontSize: "0.8rem",
                color: "#4B4F58",
                textDecoration: "underline",
              }}
            >
              Signaler ce problème
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
