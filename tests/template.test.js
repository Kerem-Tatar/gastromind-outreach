import { describe, it, expect } from 'vitest';
import { renderTemplate, findUnknownVariables, buildGreeting, templateContext, assertValidTemplate } from '../src/services/template.js';

const business = {
  name: 'Kahve Durağı',
  category: 'cafe',
  location: { province: 'İstanbul', district: 'Kadıköy' },
  contact: { contactPerson: 'Ahmet Bey' },
};

describe('şablon', () => {
  it('isim varsa kişisel, yoksa genel selamlama üretir', () => {
    expect(buildGreeting('Ahmet Bey')).toBe('Merhaba Ahmet Bey,');
    expect(buildGreeting('')).toBe('Merhaba,');
    expect(buildGreeting(undefined)).toBe('Merhaba,');
  });

  it('tüm değişkenleri doldurur', () => {
    const ctx = templateContext(business, { bookingUrl: 'https://cal.com/x' });
    const out = renderTemplate('{{greeting}} {{businessName}} / {{district}}, {{province}} / {{category}} / {{contactPerson}} / {{ bookingUrl }}', ctx);
    expect(out).toBe('Merhaba Ahmet Bey, Kahve Durağı / Kadıköy, İstanbul / kafe / Ahmet Bey / https://cal.com/x');
  });

  it('bilinmeyen değişkeni yakalar ve hata fırlatır', () => {
    expect(findUnknownVariables('Merhaba {{firstName}} {{businessName}} {{ menu }}')).toEqual(['firstName', 'menu']);
    expect(() => assertValidTemplate('{{foo}}')).toThrow(/bilinmeyen değişken/);
    expect(() => renderTemplate('{{foo}}', {})).toThrow();
  });

  it('değişkensiz şablonu olduğu gibi bırakır', () => {
    expect(renderTemplate('Düz metin', {})).toBe('Düz metin');
  });
});
