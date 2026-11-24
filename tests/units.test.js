import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseCsv } from '../src/services/csv.js';
import { resolveLocation, listProvinces, listDistricts } from '../src/services/locations.js';
import { buildOutgoingEmail } from '../src/services/emailBuilder.js';
import { redact } from '../src/config/logger.js';
import { randomDelayMs } from '../src/services/sendService.js';
import { isWithinSendWindow, startOfLocalDay } from '../src/services/time.js';
import { IN_WINDOW, WEEKEND, EVENING } from './helpers/factories.js';

describe('CSV ayrıştırıcı', () => {
  it('tırnaklı alanları, virgülü ve satır sonlarını işler', () => {
    const rows = parseCsv('﻿name,notes\n"Kafe, Bir","çok ""iyi""\nsatır"\r\nİki,\n');
    expect(rows).toEqual([{ name: 'Kafe, Bir', notes: 'çok "iyi"\nsatır' }, { name: 'İki', notes: '' }]);
  });
  it('noktalı virgül ayırıcıyı algılar', () => {
    expect(parseCsv('email;not\na@b.com;x')).toEqual([{ email: 'a@b.com', not: 'x' }]);
  });
});

describe('il/ilçe verisi', () => {
  it('81 il içerir ve kaynağı belirtir', () => {
    const data = JSON.parse(fs.readFileSync('data/tr-locations.json', 'utf8'));
    expect(data._source).toBeTruthy();
    expect(listProvinces()).toHaveLength(81);
  });
  it('büyük/küçük harf ve Türkçe karakter farkını tolere eder', () => {
    expect(resolveLocation('istanbul', 'kadikoy')).toEqual({ province: 'İstanbul', district: 'Kadıköy' });
    expect(resolveLocation('ANKARA', 'ÇANKAYA')).toEqual({ province: 'Ankara', district: 'Çankaya' });
    expect(resolveLocation('Ankara', 'Kadıköy')).toBeNull();
    expect(resolveLocation('Atlantis', 'Merkez')).toBeNull();
    expect(listDistricts('İzmir')).toContain('Karşıyaka');
  });
});

describe('Kural 4: yasal footer ve başlıklar', () => {
  const sender = { fullName: 'Kerem Tatar', companyName: 'Gastromind', email: 'kerem@gastromind.test', phone: '+90 555', address: 'Ankara' };
  const business = { unsubscribeToken: 'a'.repeat(48) };
  const message = { to: 'info@kafe.com', subject: 'Konu', body: 'Footer yok, link yok.' };

  it('her mailde gönderen adı, iletişim ve çıkma linki bulunur', () => {
    const email = buildOutgoingEmail({ message, business, sender, from: 'Gastromind <kerem@gastromind.test>' });
    const url = `https://outreach.test/unsubscribe/${'a'.repeat(48)}`;
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Kerem Tatar');
      expect(part).toContain('kerem@gastromind.test');
      expect(part).toContain(url);
    }
    expect(email.headers['List-Unsubscribe']).toContain(`<${url}>`);
    expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('boş gövdede bile footer eklenir', () => {
    const email = buildOutgoingEmail({ message: { ...message, body: '' }, business, sender, from: 'x' });
    expect(email.text).toContain('/unsubscribe/');
  });

  it('gönderen bilgisi eksikse mail oluşturulmaz', () => {
    expect(() => buildOutgoingEmail({ message, business, sender: { fullName: '', companyName: '', email: '', phone: '' }, from: 'x' }))
      .toThrow(/eksik gönderen bilgisi/);
  });
});

describe('Kural 6: bekleme süresi ve gönderim saatleri', () => {
  it('mailler arası bekleme 30–90 saniye arasındadır', () => {
    expect(randomDelayMs(() => 0)).toBe(30000);
    expect(randomDelayMs(() => 0.999999)).toBeLessThanOrEqual(90000);
    for (let i = 0; i < 100; i += 1) {
      const ms = randomDelayMs();
      expect(ms).toBeGreaterThanOrEqual(30000);
      expect(ms).toBeLessThanOrEqual(90000);
    }
  });
  it('hafta içi 09:30–17:30 İstanbul saatini uygular', () => {
    const w = { start: '09:30', end: '17:30', weekdaysOnly: true };
    expect(isWithinSendWindow(w, IN_WINDOW)).toBe(true);
    expect(isWithinSendWindow(w, WEEKEND)).toBe(false);
    expect(isWithinSendWindow(w, EVENING)).toBe(false);
    expect(isWithinSendWindow(w, new Date('2026-11-24T06:29:00Z'))).toBe(false); // 09:29
  });
  it('günün başlangıcını İstanbul saatine göre hesaplar', () => {
    expect(startOfLocalDay(new Date('2026-11-24T22:30:00Z')).toISOString()).toBe('2026-11-24T21:00:00.000Z');
  });
});

describe('Kural 8: gizli bilgiler', () => {
  it('logger bilinen gizli değerleri maskeler', () => {
    expect(redact('anahtar: re_test_secret_key')).toBe('anahtar: ***');
    expect(redact(`api ${process.env.ADMIN_API_KEY}`)).not.toContain(process.env.ADMIN_API_KEY);
  });
  it('.env dosyası repoya girmez', () => {
    const gitignore = fs.readFileSync('.gitignore', 'utf8').split('\n');
    expect(gitignore).toContain('.env');
  });
});
