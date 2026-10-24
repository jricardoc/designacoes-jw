/**
 * A abertura do app (a splash animada) terminou? As novidades e o tutorial só entram depois dela:
 * por baixo da splash ninguém veria o começo.
 */
let pronta = false;
const esperando: (() => void)[] = [];

export function marcarAberturaPronta() {
  pronta = true;
  esperando.splice(0).forEach((seguir) => seguir());
}

export const esperarAbertura = () => (pronta ? Promise.resolve() : new Promise<void>((seguir) => esperando.push(seguir)));
