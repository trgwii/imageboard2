import { Threads } from "../Thread0.ts";
import { ThreadBuf } from "../Thread1.ts";

const t = new Threads();

await Deno.mkdir("threads/v1", { recursive: true });

for await (const e of Deno.readDir("threads/v0")) {
  const id = Number(e.name);
  const stat = await Deno.stat(`threads/v0/${id}`);
  const thread = await t.load(id);
  const sfile = await Deno.open(
    `threads/v1/${id}`,
    { createNew: true, write: true },
  );
  await ThreadBuf.write({
    created: stat.birthtime ?? new Date(0),
    modified: stat.mtime ?? new Date(0),
    hash: thread.hash,
    title: thread.title,
    text: thread.text,
    replies: thread.replies,
  }, sfile);
  sfile.close();
}
