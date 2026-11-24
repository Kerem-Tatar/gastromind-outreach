// Giriş sonrası yönlendirme sadece site içi yollara yapılır (açık yönlendirme engeli).
export function safeNextPath(value) {
  const path = String(value ?? '');
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '/';
  if (path.startsWith('/login')) return '/';
  return path;
}

// CSRF koruması: veri değiştiren isteklerde Origin başlığı panelin kendi adresiyle eşleşmeli.
export function isSameOrigin(originHeader, hostHeader) {
  if (!originHeader || !hostHeader) return false;
  try {
    return new URL(originHeader).host === hostHeader;
  } catch {
    return false;
  }
}
