import { encode } from "./deps.ts";
import { ThreadBuf, Threads, type ValueFromSchema } from "./db/Thread2.ts";

const half = (buf: ArrayBuffer) => {
  const halfLength = Math.floor(buf.byteLength / 2);
  const result = new Uint8Array(halfLength);
  const b = new Uint8Array(buf);
  for (let i = 0; i < halfLength; i++) {
    result[i] = b[i] ^ b[b.byteLength - i];
  }
  return result;
};

const concat = (a: Uint8Array, b: Uint8Array) => {
  const result = new Uint8Array(a.byteLength + b.byteLength);
  result.set(a, 0);
  result.set(b, a.byteLength);
  return result;
};

const salt = await Deno.readFile("salt").catch(async () => {
  const buf = crypto.getRandomValues(new Uint8Array(64));
  await Deno.writeFile("salt", buf);
  return buf;
});

export class Board {
  readonly db: Threads;
  readonly threadCache = new Map<number, {
    cached: Date;
    value: ValueFromSchema<typeof ThreadBuf.struct.schema>;
  }>();
  readonly recentThreadCache: {
    id: number;
    created: Date;
    modified: Date;
    hash: string;
    title: string;
    replies: number;
  }[] = [];
  constructor(
    readonly threadCacheMaxSize: number,
    readonly recentThreadMaxCount: number,
    readonly name: string,
    readonly secondsUntilExpiry: number,
  ) {
    this.db = new Threads(name);
  }
  shrinkThreadCache() {
    const oldestIdsLast = Object.entries(this.threadCache).sort(
      ([, entryA], [, entryB]) => {
        const a = entryA.cached.getTime();
        const b = entryB.cached.getTime();
        return a < b ? 1 : a > b ? -1 : 0;
      },
    ).map((x) => Number(x[0]));
    while (oldestIdsLast.length > this.threadCacheMaxSize) {
      this.threadCache.delete(oldestIdsLast.pop()!);
    }
  }
  async assertThreadActive(id: number) {
    if (Number.isNaN(id)) throw new Error("Missing thread");
    if (
      (await this.db.lastModified(id)).getTime() <
        Date.now() - this.secondsUntilExpiry * 1000
    ) {
      throw new Error("Expired thread");
    }
  }
  async isThreadExpired(id: number) {
    try {
      await this.assertThreadActive(id);
      return false;
    } catch {
      return true;
    }
  }
  async isThreadFull(id: number) {
    return (await this.db.size(id)) > 1024 * 1024;
  }
  async hash(ident: string) {
    return encode(half(half(half(
      await crypto.subtle.digest(
        "SHA-256",
        concat(salt, new TextEncoder().encode(ident)),
      ),
    ))));
  }
  async getThread(id: number) {
    await this.assertThreadActive(id);
    if (this.threadCache.has(id)) return this.threadCache.get(id)!.value;
    const thread = await this.db.load(id);
    this.threadCache.set(id, { cached: new Date(), value: thread });
    this.shrinkThreadCache();
    return thread;
  }
  async recentThreads() {
    if (this.recentThreadCache.length === 0) {
      this.recentThreadCache.splice(
        0,
        Infinity,
        ...await Promise.all(
          (await this.db.recent(this.recentThreadMaxCount)).map(({ id }) =>
            this.db.loadSummary(id)
          ),
        ),
      );
    }
    return await Promise.all(this.recentThreadCache.map(async (x) => ({
      ...x,
      expired: await this.isThreadExpired(x.id),
    })));
  }

  async createThread(title: string, text: string, ident: string) {
    const id = await this.db.create(
      title,
      text,
      await this.hash(`${this.name}:${this.db.id}:${ident}`),
    );
    if (this.recentThreadCache.length >= this.recentThreadMaxCount) {
      this.recentThreadCache.pop();
    }
    this.recentThreadCache.unshift(await this.db.loadSummary(id));
    return id;
  }
  async replyToThread(id: number, text: string, ident: string) {
    await this.assertThreadActive(id);
    if (await this.isThreadFull(id)) throw new Error("Thread is full");
    await this.db.post(
      id,
      text,
      await this.hash(`${this.name}:${id}:${ident}`),
    );
    this.threadCache.delete(id);
    const idx = this.recentThreadCache.findIndex((x) => x.id === id);
    if (idx !== -1) this.recentThreadCache.splice(idx, 1);
    this.recentThreadCache.unshift(await this.db.loadSummary(id));
  }
}
