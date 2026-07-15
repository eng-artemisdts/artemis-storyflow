"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Algo deu errado</h1>
        <p style={{ maxWidth: 420, fontSize: 14, opacity: 0.7 }}>{error.message}</p>
        <button
          onClick={reset}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "#171717",
            color: "#fafafa",
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
