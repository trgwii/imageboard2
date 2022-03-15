import { Buf } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/mod.ts";
import { U8 } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/U8.ts";
import { U16 } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/U16.ts";
import { DateTime } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/DateTime.ts";
import { Optional } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/Optional.ts";
import { ArrayList } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/ArrayList.ts";
import { Text } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/Text.ts";
import { Struct } from "https://raw.githubusercontent.com/trgwii/RoryBufs/27800e3f25ea9147b1d2fcfc06c3a61c13135271/ts/fields/Struct.ts";

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

const file = await Deno.open(Deno.args[0], { read: true });

console.log(await ThreadBuf.read(file));

file.close();
