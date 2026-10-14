import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const DIRECT_URL_PREFIXES = ['http://', 'https://', 'file://', 'data:', 'blob:'];

export const isDirectMediaUrl = (path?: string | null): boolean => {
  if (!path) return false;
  return DIRECT_URL_PREFIXES.some((prefix) => path.startsWith(prefix));
};

export async function uploadRoundPhoto(params: {
  roomId: string;
  roundId: string;
  userId: string;
  localUri: string;
}): Promise<string> {
  const { roomId, roundId, userId, localUri } = params;

  if (!isSupabaseConfigured) {
    return localUri;
  }

  // Якщо це вже зовнішній https URL (наприклад, демо-пресет), не перезавантажуємо
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  const storagePath = `${roomId}/${roundId}/${userId}.jpg`;
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('room-media')
    .upload(storagePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw new Error(`Помилка завантаження фото: ${error.message}`);
  }

  return storagePath;
}

export async function resolveSignedMediaUrls(
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!isSupabaseConfigured) {
    return result;
  }

  const storagePaths = Array.from(
    new Set(
      paths.filter(
        (p): p is string => Boolean(p && !isDirectMediaUrl(p))
      )
    )
  );

  if (storagePaths.length === 0) {
    return result;
  }

  const { data, error } = await supabase.storage
    .from('room-media')
    .createSignedUrls(storagePaths, 60 * 60); // 1 година

  if (error || !data) {
    return result;
  }

  for (const item of data) {
    if (item.path && item.signedUrl) {
      result.set(item.path, item.signedUrl);
    }
  }

  return result;
}

