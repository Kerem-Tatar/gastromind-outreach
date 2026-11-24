// Kullanıcıya gösterilen hata. Mesajlar Türkçe, iç detay içermez.
export class AppError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code = 'bad_request') => new AppError(400, msg, code);
export const notFound = (msg = 'Kayıt bulunamadı.') => new AppError(404, msg, 'not_found');
export const conflict = (msg, code = 'conflict') => new AppError(409, msg, code);
