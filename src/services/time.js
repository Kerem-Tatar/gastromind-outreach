// Europe/Istanbul saat dilimi yardımcıları (Intl ile; sabit ofset varsayılmaz).
import { TIMEZONE } from '../config/constants.js';

function parts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

export function localParts(date = new Date()) {
  const p = parts(date);
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second), weekday: p.weekday,
  };
}

// İstanbul saatine göre günün başlangıcı (UTC Date olarak).
export function startOfLocalDay(date = new Date()) {
  const p = localParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMs = asUtc - Math.floor(date.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - offsetMs);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isWithinSendWindow(window, date = new Date()) {
  const p = localParts(date);
  if (window.weekdaysOnly && (p.weekday === 'Sat' || p.weekday === 'Sun')) return false;
  const minutes = p.hour * 60 + p.minute;
  return minutes >= toMinutes(window.start) && minutes < toMinutes(window.end);
}
