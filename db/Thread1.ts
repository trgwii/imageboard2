import { Buf } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/mod.ts";
import { DateTime } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/DateTime.ts";
import { ArrayList } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/ArrayList.ts";
import { Text } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/Text.ts";
import { Struct } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/fields/Struct.ts";
import { IThread } from "./IThread0.d.ts";
export type { ValueFromSchema } from "https://raw.githubusercontent.com/trgwii/RoryBufs/53263f4c24e09d5b08dd7dea01b508da7fe032e4/ts/utils.ts";

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

const { Current } = Deno.SeekMode;

export class Threads implements IThread {
  dir = "threads/v1";
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
    const sorted = recents.sort((a, b) =>
      a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0
    );
    const ids = new Set<number>();
    return Promise.all(
      sorted
        .filter((r) => ids.has(r.id) ? false : (ids.add(r.id), true))
        .map((r) => this.loadSummary(r.id)),
    );
  }
  async create(title: string, text: string, hash: string) {
    await this.init;
    const file = await Deno.open(
      `${this.dir}/${this.id}`,
      { createNew: true, write: true },
    );
    const modified = new Date();
    await ThreadBuf.write({
      created: new Date(),
      modified,
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
    // Skip version + checksum + created time
    await file.seek(4 + s.created.size, Current);

    const modified = new Date();

    // Update modtime
    await s.modified.write(modified, file);

    // Skip thread hash
    const h = await s.hash.field.length.read(file);
    await file.seek(h.value, Current);

    // Skip thread title
    const ti = await s.title.field.length.read(file);
    await file.seek(ti.value, Current);

    // Skip thread text
    const te = await s.text.field.length.read(file);
    await file.seek(te.value, Current);

    // Update reply count
    const l = await s.replies.length.read(file);
    await file.seek(-l.bytesRead, Current);
    await s.replies.length.write(l.value + 1, file);

    // Skip replies
    for (let i = 0; i < l.value; i++) {
      const hl = await s.replies.field.schema.hash.field.length.read(file);
      await file.seek(hl.value, Current);
      const tl = await s.replies.field.schema.text.field.length.read(file);
      await file.seek(tl.value, Current);
    }

    // Write reply
    await s.replies.field.write({ hash, text: replyText }, file);
    file.close();
  }

  async size(id: number) {
    await this.init;
    return (await Deno.stat(`${this.dir}/${id}`)).size;
  }
  async load(id: number) {
    await this.init;
    const file = await Deno.open(`${this.dir}/${id}`);
    const result = await ThreadBuf.read(file);
    file.close();
    return result.value;
  }
}
