export default function PageHeader({
  title,
  description,
  icon: Icon,
  color = "olive",
  children,
}) {
  // Tom do "chip" do ícone — variações quentes do tema terroso.
  const tints = {
    blue: { bg: "var(--t-success-bg)", fg: "var(--t-primary)" },
    olive: { bg: "var(--t-success-bg)", fg: "var(--t-primary)" },
    green: { bg: "var(--t-success-bg)", fg: "var(--t-green-dark)" },
    purple: { bg: "var(--t-success-bg)", fg: "var(--t-olive)" },
    orange: { bg: "var(--t-warning-bg)", fg: "var(--t-amber)" },
    sand: { bg: "var(--t-sand)", fg: "var(--t-brown)" },
  };
  const tint = tints[color] || tints.olive;

  return (
    <div
      style={{
        background: "transparent",
        padding: "2.2rem 2.5rem 1.2rem",
        marginBottom: "0.5rem",
        color: "var(--t-text)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {Icon && (
            <div
              style={{
                background: tint.bg,
                width: "52px",
                height: "52px",
                borderRadius: "15px",
                marginRight: "1.1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={26} color={tint.fg} strokeWidth={1.8} />
            </div>
          )}
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "2rem",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--t-text)",
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                style={{
                  margin: "0.4rem 0 0",
                  color: "var(--t-text-2)",
                  fontSize: "1rem",
                  fontWeight: 400,
                }}
              >
                {description}
              </p>
            )}
          </div>
        </div>

        {children && (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
