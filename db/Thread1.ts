import { Buf } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/mod.ts";
import { DateTime } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/DateTime.ts";
import { ArrayList } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/ArrayList.ts";
import { Text } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/Text.ts";
import { Struct } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/Struct.ts";
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

const { Start, Current } = Deno.SeekMode;

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
    await file.seek(offset, Current);
    const result = {
      hash: (await s.hash.read(file)).value,
      title: (await s.title.read(file)).value,
    };
    file.close();
    return result;
  }
  async lastModified(id: number) {
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`);
    const s = ThreadBuf.schema;
    const offset = 4 + s.created.size;
    await file.seek(offset, Current);
    const result = (await s.modified.read(file)).value;
    file.close();
    return result;
  }
  async loadSummary(id: number) {
    await this.init;
    const s = ThreadBuf.schema;
    const file = await Deno.open(`${this.dir}/${id}`);
    await file.seek(4, Current);
    const result = {
      id,
      birthtime: (await s.created.read(file)).value,
      mtime: (await s.modified.read(file)).value,
      hash: (await s.hash.read(file)).value,
      title: (await s.title.read(file)).value,
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
    const result = await Promise.all(
      recents.sort((a, b) => a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0)
        .map((r) => this.loadSummary(r.id)),
    );
    // this.#recent = result;
    return result;
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
      { read: true, write: true },
    );
    let offset = 4 + s.created.size;
    await file.seek(offset, Start);
    offset = await file.seek(
      offset + await s.modified.write(new Date(), file),
      Start,
    );
    const h = await s.hash.field.length.read(file);
    offset = await file.seek(offset + h.bytesRead + h.value, Start);
    const ti = await s.title.field.length.read(file);
    offset = await file.seek(offset + ti.bytesRead + ti.value, Start);
    const te = await s.text.field.length.read(file);
    offset = await file.seek(offset + te.bytesRead + te.value, Start);
    const l = await s.replies.length.read(file);
    offset = await file.seek(offset, Start);
    await s.replies.length.write(l.value + 1, file);
    offset = await file.seek(offset + l.bytesRead, Start);
    for (let i = 0; i < l.value; i++) {
      const rl = await s.replies.field.schema.hash.field.length.read(file);
      offset = await file.seek(offset + rl.bytesRead + rl.value, Start);
    }
    file.close();
    const append = await Deno.open(`${this.dir}/${id}`, { append: true });
    await s.replies.field.write({ hash, text: replyText }, append);
    append.close();
  }
  async load(id: number) {
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`);
    const result = await ThreadBuf.read(file);
    file.close();
    return result.value;
  }
}
