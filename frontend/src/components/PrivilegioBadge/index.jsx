import { privilegioInfo } from '../../utils/privilegios';

/**
 * Mostra o privilégio de serviço ao lado do nome, como um cargo.
 *
 * Não renderiza nada quando o irmão não tem privilégio, para que possa ser usado direto no
 * JSX sem condicional em volta.
 *
 * @param {string|null} privilegio  "anciao" | "servoMinisterial" | null
 * @param {"md"|"sm"}  [tamanho]    "sm" para listas, "md" para o cabeçalho do perfil
 * @param {boolean}    [abreviado]  usa o rótulo curto (útil em espaços apertados)
 */
export default function PrivilegioBadge({ privilegio, tamanho = 'md', abreviado = false }) {
  const info = privilegioInfo(privilegio);
  if (!info) return null;

  const pequeno = tamanho === 'sm';

  return (
    <span
      title={info.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: info.fundo,
        color: info.cor,
        border: `1px solid color-mix(in srgb, ${info.cor} 20%, transparent)`,
        borderRadius: '999px',
        padding: pequeno ? '4px 9px' : '5px 11px',
        fontSize: pequeno ? '0.66rem' : '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      {abreviado ? info.abreviacao : info.label}
    </span>
  );
}
