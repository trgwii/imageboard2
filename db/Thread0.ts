import type { IThread } from "./IThread0.d.ts";

function assert(ok: boolean, msg: string) {
  if (!ok) throw new Error(msg);
}

class Stream {
  #file: Deno.FsFile;
  constructor(file: Deno.FsFile) {
    this.#file = file;
  }

  async #readAll(buf: Uint8Array) {
    let nread = 0;
    while (nread < buf.byteLength) {
      const result = await this.#file.read(buf.subarray(nread));
      if (result === null) throw new Error("End of stream");
      nread += result;
    }
  }
  async #writeAll(buf: Uint8Array) {
    let nwritten = 0;
    while (nwritten < buf.length) {
      nwritten += await this.#file.write(buf.subarray(nwritten));
    }
  }

  async readU8(buf = new Uint8Array(1)) {
    await this.#file.read(buf);
    return buf[0];
  }
  async writeU8(n: number, buf = new Uint8Array(1)) {
    assert(n > 0 && n < 256, "Out of bounds");
    buf[0] = n;
    await this.#file.write(buf);
  }

  async readU16(buf = new Uint8Array(2)) {
    await this.#readAll(buf);
    return new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
      .getUint16(0);
  }
  async writeU16(n: number, buf = new Uint8Array(2)) {
    assert(n > 0 && n < 65536, "Out of bounds");
    new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
      .setUint16(0, n);
    await this.#writeAll(buf);
  }

  async readBytes(n: number) {
    assert(n > 0 && n < 65536, "Out of bounds");
    const buf = new Uint8Array(n);
    await this.#readAll(buf);
    return buf;
  }

  async readShortString() {
    const size = await this.readU8();
    return new TextDecoder().decode(await this.readBytes(size));
  }
  async writeShortString(str: string) {
    const buf = new TextEncoder().encode(str);
    await this.writeU8(buf.byteLength);
    await this.#writeAll(buf);
  }

  async readLongString() {
    const size = await this.readU16();
    return new TextDecoder().decode(await this.readBytes(size));
  }

  async writeLongString(str: string) {
    const buf = new TextEncoder().encode(str);
    await this.writeU16(buf.byteLength);
    await this.#writeAll(buf);
  }
}

export class Threads implements IThread {
  dir = "threads/v0";
  id!: number;
  init: Promise<void>;
  constructor() {
    this.init = Deno.mkdir(this.dir, { recursive: true }).then(async () => {
      this.id = await this.findAvailableId();
    });
  }
  async findAvailableId() {
    let max = 0;
    for await (const d of Deno.readDir(this.dir)) {
      const id = Number(d.name);
      if (!Number.isNaN(id) && id > max) max = id;
    }
    return max + 1;
  }

  async loadTitle(id: number) {
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`);
    const stream = new Stream(file);
    const result = {
      title: await stream.readShortString(),
      hash: await stream.readShortString(),
    };
    file.close();
    return result;
  }

  async lastModified(id: number) {
    await this.init;
    const { mtime } = await Deno.stat(`${this.dir}/${id}`);
    return mtime!;
  }

  async recent(max: number) {
    const recents: { id: number; birthtime: number; mtime: number }[] = [];
    await this.init;
    for await (const d of Deno.readDir(this.dir)) {
      const id = Number(d.name);
      const { birthtime, mtime } = await Deno.stat(`${this.dir}/${id}`);
      if (!birthtime || !mtime) {
        continue;
      }
      if (recents.length < max) {
        recents.push({
          id,
          birthtime: birthtime.getTime(),
          mtime: mtime.getTime(),
        });
        continue;
      }
      if (mtime.getTime() > Math.min(...recents.map((x) => x.mtime))) {
        const oldestIdx = recents.findIndex((x) =>
          x.mtime === Math.min(...recents.map((x) => x.mtime))
        );
        recents.splice(oldestIdx, 1);
        recents.push({
          id,
          birthtime: birthtime.getTime(),
          mtime: mtime.getTime(),
        });
      }
    }
    return Promise.all(
      recents
        .sort((a, b) => a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0)
        .map(async (r) => ({
          id: r.id,
          birthtime: new Date(r.birthtime),
          mtime: new Date(r.mtime),
          ...(await this.loadTitle(r.id)),
        })),
    );
  }
  async create(title: string, text: string, hash: string) {
    const titleBuf = new TextEncoder().encode(title);
    assert(titleBuf.byteLength < 256, "Title too long");
    const textBuf = new TextEncoder().encode(text);
    assert(textBuf.byteLength < 65536, "Text too long");
    await this.init;
    const file = await Deno.open(`${this.dir}/${this.id}`, {
      createNew: true,
      write: true,
    });
    const stream = new Stream(file);
    await stream.writeShortString(title);
    await stream.writeShortString(hash);
    await stream.writeLongString(text);
    file.close();
    return this.id++;
  }
  async post(id: number, replyText: string, hash: string) {
    const replyTextBuf = new TextEncoder().encode(replyText);
    assert(replyTextBuf.byteLength < 65536, "Text too long");
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`, { append: true });
    const stream = new Stream(file);
    await stream.writeShortString(hash);
    await stream.writeLongString(replyText);
  }
  async load(id: number) {
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`);
    const stream = new Stream(file);
    const result = {
      title: await stream.readShortString(),
      hash: await stream.readShortString(),
      text: await stream.readLongString(),
      replies: [] as { hash: string; text: string }[],
    };
    try {
      while (true) {
        result.replies.push({
          hash: await stream.readShortString(),
          text: await stream.readLongString(),
        });
      }
    } catch {
      // end of stream
    }
    file.close();
    return result;
  }
}
