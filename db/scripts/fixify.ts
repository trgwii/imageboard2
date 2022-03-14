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

  await file.seek(4, Start);

  const modtimeOffset = await file.seek(s.created.size, Current);
  const modtime = (await s.modified.read(file)).value;
  await file.seek((await s.hash.field.length.read(file)).value, Current);
  await file.seek((await s.title.field.length.read(file)).value, Current);
  const replyOffset = await file.seek(
    (await s.text.field.length.read(file)).value,
    Current,
  );
  const replies = (await s.replies.length.read(file)).value;
  let actualReplies = 0;

  let lastReply: ValueFromSchema<typeof s.replies.field.schema> | null = null;
  while (true) {
    try {
      lastReply = (await s.replies.field.read(file)).value;
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

for await (const t of Deno.readDir("boards/main/threads/v2")) {
  await fixifyThread(`boards/main/threads/v2/${t.name}`, true);
}
