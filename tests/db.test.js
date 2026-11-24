import { describe, it, expect } from 'vitest';
import { dbNameFromUri, mongoConnectOptions, DEFAULT_DB_NAME } from '../src/config/db.js';

describe('MongoDB veritabanı adı', () => {
  it('adreste isim varsa onu kullanır', () => {
    expect(dbNameFromUri('mongodb+srv://u:p@x.mongodb.net/outreach?retryWrites=true')).toBe('outreach');
    expect(mongoConnectOptions('mongodb://u:p@h1:27017,h2:27017/benim-db?ssl=true').dbName).toBe('benim-db');
  });
  it('adreste isim yoksa varsayılanı kullanır ("test" değil)', () => {
    for (const uri of [
      'mongodb+srv://u:p@x.mongodb.net/?retryWrites=true&w=majority',
      'mongodb+srv://u:p@x.mongodb.net/',
      'mongodb+srv://u:p@x.mongodb.net',
      'mongodb+srv://u:p@x.mongodb.net?retryWrites=true',
    ]) expect(mongoConnectOptions(uri).dbName).toBe(DEFAULT_DB_NAME);
  });
});
