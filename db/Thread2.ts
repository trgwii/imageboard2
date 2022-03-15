import { Buf } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/mod.ts";
import { U8 } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/fields/U8.ts";
import { U16 } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/fields/U16.ts";
import { DateTime } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/fields/DateTime.ts";
import { Optional } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/fields/Optional.ts";
import { ArrayList } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/fields/ArrayList.ts";
import { Text } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/fields/Text.ts";
import { Struct } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/fields/Struct.ts";
import { IThread } from "./IThread1.d.ts";
export type { ValueFromSchema } from "https://raw.githubusercontent.com/trgwii/RoryBufs/bdc60bc9e1d60c308ede6153a1c7854014b2c929/ts/utils.ts";

export const ThreadBuf = new Buf({
  created: new DateTime(),
  modified: new DateTime(),
  hash: new Text(new U8()),
  title: new Text(new U8()),
  text: new Text(new U16()),
  replies: new ArrayList(
    new Struct({
      created: new Optional(new DateTime()),
      hash: new Text(new U8()),
      text: new Text(new U16()),
    }),
  ),
});

const { Start, Current } = Deno.SeekMode;

export class Threads implements IThread {
  dir: string;
  id!: number;
  init: Promise<void>;
  constructor(board: string) {
    this.dir = `boards/${board}/threads/v2`;
    this.init = Deno.mkdir(this.dir, { recursive: true })
      .then(async () => {
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
    const s = ThreadBuf.struct.schema;
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
    const s = ThreadBuf.struct.schema;
    const offset = 4 + s.created.size;
    await file.seek(offset, Current);
    const result = (await s.modified.read(file)).value;
    file.close();
    return result;
  }
  async loadSummary(id: number) {
    await this.init;
    const s = ThreadBuf.struct.schema;
    const file = await Deno.open(`${this.dir}/${id}`);
    await file.seek(4, Current);
    const result = {
      id,
      created: (await s.created.read(file)).value,
      modified: (await s.modified.read(file)).value,
      hash: (await s.hash.read(file)).value,
      title: (await s.title.read(file)).value,
      replies: 0,
    };
    const { value: textSize } = await s.text.field.length.read(file);
    await file.seek(textSize, Deno.SeekMode.Current);
    const { value: replies } = await s.replies.length.read(file);
    result.replies = replies;
    file.close();
    return result;
  }
  async recent(max: number, recents: { id: number; modified: number }[] = []) {
    for await (const d of Deno.readDir(this.dir)) {
      const id = Number(d.name);
      const modified = (await this.lastModified(id)).getTime();
      if (recents.length < max) {
        recents.push({
          id,
          modified,
        });
        continue;
      }
      const oldestMtime = Math.min(...recents.map((x) => x.modified));
      if (modified > oldestMtime) {
        const oldestIdx = recents.findIndex((x) => x.modified === oldestMtime);
        recents.splice(oldestIdx, 1);
        recents.push({ id, modified });
      }
    }
    const sorted = recents.sort((a, b) =>
      a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : 0
    );
    const ids = new Set<number>();
    return Promise.all(
      sorted.filter((r) => ids.has(r.id) ? false : (ids.add(r.id), true)),
    );
  }
  async create(title: string, text: string, hash: string) {
    if (typeof title !== "string" || title.length < 1 || title.length > 255) {
      throw new Error("bad title");
    }
    if (typeof text !== "string" || text.length < 1 || text.length > 65535) {
      throw new Error("bad text");
    }
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
  async post(id: number, replyText: string, hash: string) {
    if (
      typeof replyText !== "string" || replyText.length < 1 ||
      replyText.length > 65535
    ) {
      throw new Error("bad text");
    }
    await this.init;
    const s = ThreadBuf.struct.schema;
    const file = await Deno.open(
      `${this.dir}/${id}`,
      { read: true, write: true },
    );
    // Skip version + checksum + created time
    const modtimeOffset = await file.seek(
      4 + s.created.size,
      Current,
    );

    // Skip modified time
    await file.seek(s.modified.size, Current);

    // Skip thread hash
    const h = await s.hash.field.length.read(file);
    await file.seek(h.value, Current);

    // Skip thread title
    const ti = await s.title.field.length.read(file);
    await file.seek(ti.value, Current);

    // Skip thread text
    const te = await s.text.field.length.read(file);
    const replyCountOffset = await file.seek(te.value, Current);

    // Get reply count
    const l = await s.replies.length.read(file);

    // Skip replies
    for (let i = 0; i < l.value; i++) {
      await s.replies.field.schema.created.read(file);
      const hl = await s.replies.field.schema.hash.field.length.read(file);
      await file.seek(hl.value, Current);
      const tl = await s.replies.field.schema.text.field.length.read(file);
      await file.seek(tl.value, Current);
    }

    const modified = new Date();

    // Write reply
    await s.replies.field.write({
      created: modified,
      hash,
      text: replyText,
    }, file);

    // Update modtime
    await file.seek(modtimeOffset, Start);
    await s.modified.write(modified, file);

    // Update reply count
    await file.seek(replyCountOffset, Start);
    await s.replies.length.write(l.value + 1, file);

    file.close();
  }
}
