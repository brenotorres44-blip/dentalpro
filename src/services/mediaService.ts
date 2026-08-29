import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

/**
 * ARQUIVOS DA EMPRESA — logo e fotos
 *
 * O bucket é público para leitura (a logo aparece na vitrine, que é anônima) e
 * restrito para escrita pela policy do `0010`, que compara a **primeira pasta
 * do caminho** com as empresas de que o usuário é membro.
 *
 * Por isso o caminho não é decorativo: `<company_id>/logo.png` é o que autoriza
 * a gravação. Montá-lo em qualquer outro lugar do código abriria a chance de
 * alguém montar errado e receber um 403 sem entender por quê — então ele é
 * montado só aqui.
 *
 * O banco guarda o **caminho**, nunca a URL. O domínio do storage muda ao
 * migrar de projeto, e uma base cheia de URLs absolutas viraria uma migração de
 * string em vez de uma troca de configuração.
 */

const BUCKET = 'company-media';

/** 2 MB — o mesmo teto do bucket. Aqui é cortesia; lá é a barreira. */
export const MAX_BYTES = 2 * 1024 * 1024;

export const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export const logoPath = (companyId: string, ext: string) => `${companyId}/logo.${ext}`;

export const photoPath = (companyId: string, professionalId: string, ext: string) =>
  `${companyId}/profissionais/${professionalId}.${ext}`;

/** Caminho gravado → endereço que o `<img>` entende. */
export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!isSupabaseConfigured || !supabase) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

export async function upload(file: File, path: string): Promise<UploadResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      error: 'O envio de arquivos exige o Supabase configurado (veja docs/05-supabase.md).',
    };
  }

  if (!ACCEPTED.includes(file.type)) {
    return { ok: false, error: 'Formato não aceito. Use PNG, JPG, WEBP ou SVG.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'A imagem passa de 2 MB. Reduza antes de enviar.' };
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    // `upsert`: o caminho da logo é fixo por empresa. Sem isso, a segunda troca
    // falharia com "já existe" e a clínica ficaria presa na primeira logo.
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('row-level security') || m.includes('unauthorized')) {
      return { ok: false, error: 'Você não tem permissão para alterar as imagens desta clínica.' };
    }
    if (m.includes('exceeded') || m.includes('too large')) {
      return { ok: false, error: 'A imagem passa do limite de 2 MB.' };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, path };
}

export async function remove(path: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: true };

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** A extensão sai do tipo declarado, não do nome — o nome vem do usuário. */
export function extensionOf(file: File): string {
  switch (file.type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'jpg';
  }
}
