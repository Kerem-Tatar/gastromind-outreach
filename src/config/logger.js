// Basit logger. Mesajlardaki bilinen gizli değerler (API anahtarları vb.) maskelenir (Kural 8).
import { secretValues } from './env.js';

export function redact(text) {
  let out = String(text);
  for (const secret of secretValues()) {
    out = out.split(secret).join('***');
  }
  return out;
}

function format(args) {
  return args
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a)))
    .map(redact)
    .join(' ');
}

export const logger = {
  info: (...args) => { if (process.env.NODE_ENV !== 'test') console.log(format(args)); },
  warn: (...args) => { if (process.env.NODE_ENV !== 'test') console.warn(format(args)); },
  error: (...args) => { if (process.env.NODE_ENV !== 'test') console.error(format(args)); },
};
