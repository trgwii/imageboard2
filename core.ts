import { encode } from "./deps.ts";
import { ThreadBuf, Threads, type ValueFromSchema } from "./db/Thread1.ts";

export class Core {
  readonly db = new Threads();
  readonly threadCache: Record<string, {
    cached: Date;
    value: ValueFromSchema<typeof ThreadBuf.schema>;
  }> = {};
  readonly recentThreadCache: {
    id: number;
    birthtime: Date;
    mtime: Date;
    hash: string;
    title: string;
  }[] = [];
  constructor(
    readonly threadCacheMaxSize: number,
    readonly recentThreadMaxCount: number,
  ) {}
  shrinkThreadCache() {
    const oldestIdsLast = Object.entries(this.threadCache).sort(
      ([, entryA], [, entryB]) => {
        const a = entryA.cached.getTime();
        const b = entryB.cached.getTime();
        return a < b ? 1 : a > b ? -1 : 0;
      },
    ).map((x) => x[0]);
    while (oldestIdsLast.length > this.threadCacheMaxSize) {
      delete this.threadCache[oldestIdsLast.pop()!];
    }
  }
  async assertThreadActive(id: number) {
    if (Number.isNaN(id)) throw new Error("Missing thread");
    if (
      (await this.db.lastModified(id)).getTime() <
        Date.now() - 7 * 24 * 60 * 60 * 1000
    ) {
      throw new Error("Expired thread");
    }
  }
  async isThreadFull(id: number) {
    return (await this.db.size(id)) > 1024 * 1024;
  }
  hash() {
    return encode(
      crypto.getRandomValues(new Uint8Array(12)),
      { standard: "Z85" },
    );
  }
  async getThread(id: number) {
    await this.assertThreadActive(id);
    if (id in this.threadCache) return this.threadCache[id].value;
    const thread = await this.db.load(id);
    this.threadCache[id] = { cached: new Date(), value: thread };
    this.shrinkThreadCache();
    return thread;
  }
  async recentThreads() {
    if (this.recentThreadCache.length > 0) return this.recentThreadCache;
    this.recentThreadCache.splice(0, Infinity, ...await this.db.recent(10));
    return this.recentThreadCache;
  }

  createThread(title: string, text: string) {
    if (!title || title.length < 1 || title.length > 255) {
      throw new Error("Bad title");
    }
    if (!text || text.length < 1 || text.length > 65535) {
      throw new Error("Bad text");
    }
    this.recentThreadCache.splice(0, Infinity);
    return this.db.create(title, text, this.hash());
  }
  async replyToThread(id: number, text: string) {
    await this.assertThreadActive(id);
    if (await this.isThreadFull(id)) throw new Error("Thread is full");
    await this.db.post(id, text, this.hash());
    delete this.threadCache[id];
    this.recentThreadCache.splice(0, Infinity);
  }
}
