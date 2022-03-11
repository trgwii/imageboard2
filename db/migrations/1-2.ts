import { Threads } from "../Thread1.ts";
import { ThreadBuf } from "../Thread2.ts";

const t = new Threads();

await Deno.mkdir("boards/main/threads/v2", { recursive: true });

for await (const e of Deno.readDir("threads/v1")) {
  const id = Number(e.name);
  const stat = await Deno.stat(`threads/v1/${id}`);
  const thread = await t.load(id);
  const sfile = await Deno.open(
    `boards/main/threads/v2/${id}`,
    { createNew: true, write: true },
  );
  if (thread.text.length > 65535) {
    console.log(thread);
  }
  await ThreadBuf.write({
    created: stat.birthtime ?? new Date(0),
    modified: stat.mtime ?? new Date(0),
    hash: thread.hash,
    title: thread.title,
    text: thread.text.slice(0, 65535),
    replies: thread.replies
      .filter((reply) =>
        ![
          "vT=14nTlIE&!4:u",
          "k.fG54$f#PPF9f>",
          "F:RhkuDY/^vTCD6",
          "ykuIUXARXWuB2Dv",
          "BX!IuAHUyo(dB*W",
        ].includes(reply.hash) && !(id === 3219 && reply.hash === "xjMWlQ")
      )
      .map((reply) => {
        if (reply.text.length > 65535) {
          console.log(id, reply);
        }
        return {
          created: null,
          ...reply,
        };
      }),
  }, sfile);
  sfile.close();
}
