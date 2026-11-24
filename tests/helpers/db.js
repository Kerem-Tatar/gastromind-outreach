// Her test dosyası için bellek içi MongoDB. Sistemde mongod varsa MONGOMS_SYSTEM_BINARY ile kullanılabilir.
import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

export function useTestDb() {
  let server;
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { dbName: 'test' });
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  });
  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}
