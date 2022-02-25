import { Buf } from "https://raw.githubusercontent.com/trgwii/RoryBufs/02832e14f690a7398539b8aebfd47e1a30a3828a/ts/mod.ts";
import { DateTime } from "https://raw.githubusercontent.com/trgwii/RoryBufs/02832e14f690a7398539b8aebfd47e1a30a3828a/ts/fields/DateTime.ts";
import { ArrayList } from "https://raw.githubusercontent.com/trgwii/RoryBufs/02832e14f690a7398539b8aebfd47e1a30a3828a/ts/fields/ArrayList.ts";
import { Text } from "https://raw.githubusercontent.com/trgwii/RoryBufs/02832e14f690a7398539b8aebfd47e1a30a3828a/ts/fields/Text.ts";
import { Struct } from "https://raw.githubusercontent.com/trgwii/RoryBufs/02832e14f690a7398539b8aebfd47e1a30a3828a/ts/fields/Struct.ts";
import { IThread } from "./IThread0.d.ts";

export const ThreadBuf = new Buf({
  created: new DateTime(),
  modified: new DateTime(),
  hash: new Text(),
  title: new Text(),
  text: new Text(),
  replies: new ArrayList(
    new Struct({
      hash: new Text(),
      text: new Text(),
    }),
  ),
});

export class Threads implements IThread {
  dir = "threads/v1";
  id!: number;
  #recent?: {
    title: string;
    hash: string;
    id: number;
    birthtime: Date;
    mtime: Date;
  }[];
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
    const s = ThreadBuf.schema;
    const offset = 4 + s.created.size + s.modified.size;
    await file.seek(offset, Deno.SeekMode.Current);
    const result = {
      hash: await s.hash.read(file),
      title: await s.title.read(file),
    };
    file.close();
    return result;
  }
  async lastModified(id: number) {
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`);
    const s = ThreadBuf.schema;
    const offset = 4 + s.created.size;
    await file.seek(offset, Deno.SeekMode.Current);
    const result = await s.modified.read(file);
    file.close();
    return result;
  }
  async loadSummary(id: number) {
    await this.init;
    const s = ThreadBuf.schema;
    const file = await Deno.open(`${this.dir}/${id}`);
    await file.seek(4, Deno.SeekMode.Current);
    const result = {
      id,
      birthtime: await s.created.read(file),
      mtime: await s.modified.read(file),
      hash: await s.hash.read(file),
      title: await s.title.read(file),
    };
    file.close();
    return result;
  }
  async recent(max: number) {
    if (this.#recent) return this.#recent;
    const recents: { id: number; mtime: number }[] = [];
    for await (const d of Deno.readDir(this.dir)) {
      const id = Number(d.name);
      const mtime = (await this.lastModified(id)).getTime();
      if (recents.length < max) {
        recents.push({
          id,
          mtime,
        });
        continue;
      }
      const oldestMtime = Math.min(...recents.map((x) => x.mtime));
      if (mtime > oldestMtime) {
        const oldestIdx = recents.findIndex((x) => x.mtime === oldestMtime);
        recents.splice(oldestIdx, 1);
        recents.push({ id, mtime });
      }
    }
    return Promise.all(
      recents.sort((a, b) => a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0)
        .map((r) => this.loadSummary(r.id)),
    );
  }
  async create(title: string, text: string, hash: string) {
    await this.init;
    const file = await Deno.open(
      `${this.dir}/${this.id}`,
      { createNew: true, write: true },
    );
    await ThreadBuf.write({
      created: new Date(),
      modified: new Date(),
      hash,
      title,
      text,
      replies: [],
    }, file);
    file.close();
    return this.id++;
  }
  async post(id: number, replyText: string, hash: string) {
    await this.init;
    const s = ThreadBuf.schema;
    const file = await Deno.open(
      `${this.dir}/${id}`,
      { read: true, write: true, append: true },
    );
    let offset = 4 + s.created.size;
    await file.seek(offset, Deno.SeekMode.Start);
    offset += await s.modified.write(new Date(), file);
    console.log(offset);
    offset += await s.hash.field.length.read(file);
    await file.seek(offset, Deno.SeekMode.Start);
    offset += await s.title.field.length.read(file);
    await file.seek(offset, Deno.SeekMode.Start);
    offset += await s.text.field.length.read(file);
    await file.seek(offset, Deno.SeekMode.Start);
    const length = await s.replies.length.read(file);
    await file.seek(-s.replies.length.size, Deno.SeekMode.Current);
    await s.replies.length.write(length + 1, file);
    for (let i = 0; i < length; i++) {
      const length = await s.replies.field.schema.hash.field.length.read(file);
      await file.seek(length, Deno.SeekMode.Current);
    }
    await s.replies.field.write({ hash, text: replyText }, file);
    file.close();
  }
  async load(id: number) {
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`);
    const result = await ThreadBuf.read(file);
    file.close();
    return result;
  }
}
