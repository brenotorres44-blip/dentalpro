/**
 * Sem cantoneira.
 *
 * Existia para dar leitura de "moldura de instrumento" aos painéis — o oposto
 * do que um consultório pede. O componente fica no lugar (é import de ~15
 * telas) só para não obrigar uma segunda rodada de edições; ele não desenha
 * mais nada.
 */
export function CornerBrackets(_props: {
  className?: string;
  size?: number;
  tone?: 'hud' | 'critical' | 'faint';
}) {
  return null;
}
