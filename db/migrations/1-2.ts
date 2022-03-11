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
  await ThreadBuf.write({
    created: stat.birthtime ?? new Date(0),
    modified: stat.mtime ?? new Date(0),
    hash: thread.hash,
    title: thread.title,
    text: thread.text.slice(0, 65535),
    replies: thread.replies.map((reply) => ({
      created: null,
      ...reply,
    })),
  }, sfile);
  sfile.close();
}
