export default function PageHeader({
  title,
  description,
  icon: Icon,
  color = "olive",
  children,
}) {
  // Tom do "chip" do ícone — variações quentes do tema terroso.
  const tints = {
    blue: { bg: "#EAEFDC", fg: "#5E6B48" },
    olive: { bg: "#EAEFDC", fg: "#5E6B48" },
    green: { bg: "#E2E7D2", fg: "#54622F" },
    purple: { bg: "#EAEFDC", fg: "#6E7B57" },
    orange: { bg: "#F3E2CD", fg: "#9A5A38" },
    sand: { bg: "#EDE6D5", fg: "#9A7E55" },
  };
  const tint = tints[color] || tints.olive;

  return (
    <div
      style={{
        background: "transparent",
        padding: "2.2rem 2.5rem 1.2rem",
        marginBottom: "0.5rem",
        color: "#2B2620",
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
                color: "#2B2620",
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                style={{
                  margin: "0.4rem 0 0",
                  color: "#8A8071",
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
