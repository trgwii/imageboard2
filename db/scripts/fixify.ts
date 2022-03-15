import { Buf } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/mod.ts";
import { U8 } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/U8.ts";
import { U16 } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/U16.ts";
import { DateTime } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/DateTime.ts";
import { Optional } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/Optional.ts";
import { ArrayList } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/ArrayList.ts";
import { Text } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/Text.ts";
import { Struct } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/Struct.ts";
import type { ValueFromSchema } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/utils.ts";

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

const s = ThreadBuf.schema;
const { Start, Current } = Deno.SeekMode;

const fixifyThread = async (path: string, dryRun: boolean) => {
  const file = await Deno.open(path, { read: true, write: !dryRun });
  console.log('path', path);
  console.log('seek past checksum');
  await file.seek(4, Start);

  console.log('seek over created');
  const modtimeOffset = await file.seek(s.created.size, Current);
  console.log('read modified');
  const modtime = (await s.modified.read(file)).value;
  console.log('seek over hash');
  await file.seek((await s.hash.field.length.read(file)).value, Current);
  console.log('seek over title');
  await file.seek((await s.title.field.length.read(file)).value, Current);
  console.log('reading text length');
  const textLength = (await s.text.field.length.read(file).catch(() => ({ value: 0 }))).value;
  if (!dryRun) await file.seek(-s.text.field.length.size, Current);
  if (!dryRun) await s.text.field.length.write(textLength, file);
  console.log('got text length:', textLength);
  console.log('seek over text');
  const replyOffset = await file.seek(textLength, Current);
  console.log('read reply count');
  const replies = (await s.replies.length.read(file).catch(() => ({ value: 0 }))).value;
  if (!dryRun) await file.seek(-s.replies.length.size, Current);
  if (!dryRun) await s.replies.length.write(replies, file);
  let actualReplies = 0;

  let lastReply: ValueFromSchema<typeof s.replies.field.schema> | null = null;
  while (true) {
    try {
      lastReply = (await s.replies.field.read(file)).value;
      console.log('read reply');
      actualReplies++;
    } catch {
      break;
    }
  }

  if (lastReply && lastReply.created) {
    console.log(path, ":", modtime, "->", lastReply.created);
    await file.seek(modtimeOffset, Start);
    if (!dryRun) await s.modified.write(lastReply.created, file);
  }
  if (actualReplies !== replies) {
    console.log(path, ":", replies, "->", actualReplies);
    await file.seek(replyOffset, Start);
    if (!dryRun) await s.replies.length.write(actualReplies, file);
  }

  file.close();
};

for await (const t of Deno.readDir("boards/" + Deno.args[0] + "/threads/v2")) {
  await fixifyThread(`boards/${Deno.args[0]}/threads/v2/${t.name}`, false);
}
