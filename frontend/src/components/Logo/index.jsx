/**
 * Logo "Servir Mais" — marca S+ em creme sobre o quadrado oliva (mesma do app).
 * `size` = lado do ícone; `wordmark` mostra o nome ao lado; `mark` controla cor.
 */
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function LogoMark({ size = 40, radius }) {
  const r = radius ?? size * 0.26;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Servir Mais">
      <defs>
        <radialGradient id="sm-grad" cx="50%" cy="36%" r="80%">
          <stop offset="0%" stopColor="#7C895F" />
          <stop offset="46%" stopColor="#5E6A46" />
          <stop offset="100%" stopColor="#404930" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx={(r / size) * 100} fill="url(#sm-grad)" />
      <text
        x="40.4"
        y="70.7"
        fontFamily={FONT}
        fontSize="60"
        fontWeight="800"
        letterSpacing="-2.4"
        fill="#FBF7EF"
        textAnchor="middle"
      >
        S
      </text>
      <text
        x="65"
        y="42.8"
        fontFamily={FONT}
        fontSize="28"
        fontWeight="800"
        fill="#FBF7EF"
        textAnchor="middle"
      >
        +
      </text>
    </svg>
  );
}

export default function Logo({ size = 40, wordmark = false, color = "#2B2620", gap = "0.65rem" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      <LogoMark size={size} />
      {wordmark && (
        <span
          style={{
            fontFamily: FONT,
            fontSize: `${Math.round(size * 0.46)}px`,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color,
            whiteSpace: "nowrap",
          }}
        >
          Servir Mais
        </span>
      )}
    </div>
  );
}
