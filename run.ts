import {
  elements,
  encode,
  get,
  type HyperNode,
  post,
  router,
  serve,
  trust,
} from "./deps.ts";
import { Threads } from "./db/Thread0.ts";
import { markdown } from "./md.ts";

const logErr = (err: Error) => console.error(err.message);

const {
  html,
  head,
  meta,
  article,
  title,
  body,
  h1,
  form,
  input,
  textarea,
  script,
  br,
  section,
  hr,
  p,
  a,
  style,
  h6,
} = elements;
const t = new Threads();

const cache: Record<string, { created: Date; data: HyperNode }> = {};

setInterval(() => {
  for (const [id, { created }] of Object.entries(cache)) {
    if (created.getTime() < Date.now() - 15 * 60 * 1000) {
      delete cache[id];
    }
  }
}, 60_000);

// const markdown = (text: string) =>
//   text
//     .replaceAll("&", "&amp;")
//     .replaceAll("<", "&lt;")
//     .replaceAll(">", "&gt;")
//     .replace(
//       /\b(https?:\/\/.+?)("|\s|\))/g,
//       (_, m: string, rest: string) =>
//         renderHTML(a({ href: String(m) }, String(m))) + rest,
//     )
//     .replace(/\*\*(.+?)\*\*/g, (_, m: string) => renderHTML(strong(m)))
//     .replace(/__(.+?)__/g, (_, m: string) => renderHTML(strong(m)))
//     .replace(/\*(.+?)\*/g, (_, m: string) => renderHTML(em(m)))
//     .replace(/_(.+?)_/g, (_, m: string) => renderHTML(em(m)))
//     .replace(/```(.+?)```/gms, (_, m: string) => renderHTML(pre(code(m))))
//     .replace(/`(.+?)`/g, (_, m: string) => renderHTML(pre(m)))
//     .replaceAll("\n", renderHTML(br()));

const server = serve(
  { port: 8080, hostname: "127.0.0.1" },
  router(
    get(
      "/",
      async (ctx) =>
        ctx.render(html(
          head(
            meta({ charset: "utf-8" }),
            meta({
              name: "viewport",
              content: "width=device-width, initial-scale=1",
            }),
            title("Thomas's Cool Forum Software"),
          ),
          body(
            h1(
              "Thomas's Cool Forum Software",
            ),
            form(
              { method: "POST", action: "/api/thread/create" },
              section(input({
                type: "text",
                name: "title",
                placeholder: "Thread title",
                maxlength: 256,
              })),
              section(
                textarea({
                  name: "text",
                  placeholder: "Thread text",
                  maxlength: 65536,
                  cols: 60,
                  rows: 5,
                }),
              ),
              section(input({ type: "submit", value: "Create thread" })),
            ),
            ...(await t.recent(10)).flatMap(
              (
                x,
              ) => [
                hr(),
                p(
                  x.birthtime.toISOString()
                    .replace("T", " ")
                    .replace(/:\d{2}\..+/, ""),
                  " | ",
                  x.mtime.toISOString()
                    .replace("T", " ")
                    .replace(/:\d{2}\..+/, ""),
                  " | ",
                  x.hash,
                  br(),
                  a({ href: "/thread/" + x.id }, x.title),
                ),
              ],
            ),
          ),
        )).catch(logErr),
    ),
    get("/thread/:id", async (ctx) => {
      const id = Number(new URL(ctx.request.url).pathname.split("/")[2]);
      if (Number.isNaN(id)) {
        return ctx.respond("Missing thread").catch(logErr);
      }
      if (
        (await t.lastModified(id)).getTime() <
          Date.now() - 7 * 24 * 60 * 60 * 1000
      ) {
        return ctx.respond("Expired thread").catch(logErr);
      }
      try {
        if (id in cache) return ctx.render(cache[id].data).catch(logErr);

        const { title: tit, text, hash, replies } = await t.load(id);
        const vdom = html(
          head(
            meta({ charset: "utf-8" }),
            meta({
              name: "viewport",
              content: "width=device-width, initial-scale=1",
            }),
            title("Thomas's Cool Forum Software - " + tit),
            style("div.language-id { display: none; }"),
          ),
          body(
            a({ href: "/" }, "Back to main page"),
            h1(tit),
            h6(hash),
            article(trust(await markdown(text))),
            ...(await Promise.all(replies.map(async (r) => [
              hr(),
              article(h6(r.hash), trust(await markdown(r.text))),
            ]))).flat(),
            form(
              { method: "POST", action: "/api/thread/post" },
              input({ type: "hidden", name: "id", value: String(id) }),
              section(
                textarea({
                  name: "text",
                  placeholder: "Reply text",
                  maxlength: 65536,
                  cols: 60,
                  rows: 6,
                }),
              ),
              section(input({ type: "submit", value: "Reply to thread" })),
            ),
            script({ type: "application/javascript", src: "/tooltip.js" }),
          ),
        );
        cache[id] = { created: new Date(), data: vdom };
        return ctx.render(vdom).catch(logErr);
      } catch (err) {
        return ctx.respond(err.message, { status: 400 }).catch(logErr);
      }
    }),
    post("/api/thread/create", async (ctx) => {
      const fd = await ctx.request.formData();
      const title = fd.get("title")!;
      if (!title || typeof title !== "string") {
        return ctx.respond("Bad title", { status: 400 }).catch(logErr);
      }

      const text = fd.get("text")!;
      if (!text || typeof text !== "string") {
        return ctx.respond("Bad text", { status: 400 }).catch(logErr);
      }

      try {
        const hash = encode(crypto.getRandomValues(new Uint8Array(12)), {
          standard: "Z85",
        });
        const id = await t.create(title, text, hash);
        console.log("thread create", id, title, hash);
        return ctx.respond(
          new Response(null, {
            status: 302,
            headers: { "Location": `/thread/${id}` },
          }),
        ).catch(logErr);
      } catch (err) {
        return ctx.respond(err.message, { status: 400 }).catch(logErr);
      }
    }),
    post("/api/thread/post", async (ctx) => {
      const fd = await ctx.request.formData();
      const id = Number(fd.get("id")!);
      if (Number.isNaN(id)) {
        return ctx.respond("Bad thread id", { status: 400 }).catch(
          logErr,
        );
      }

      const text = fd.get("text")!;
      if (!text || typeof text !== "string") {
        return ctx.respond("Bad text", { status: 400 }).catch(logErr);
      }

      try {
        const hash = encode(crypto.getRandomValues(new Uint8Array(12)), {
          standard: "Z85",
        });
        console.log("thread post", id, hash);
        await t.post(
          id,
          text,
          hash,
        );
        delete cache[id];
        return ctx.respond(
          new Response(null, {
            status: 302,
            headers: { "Location": `/thread/${id}` },
          }),
        ).catch(logErr);
      } catch (err) {
        return ctx.respond(err.message, { status: 400 }).catch(logErr);
      }
    }),
    get("/api/self/hash", (ctx) => {
      return ctx.respond(ctx.request.headers.get("X-Forwarded-For"));
    }),
    get("/tooltip.js", async (ctx) => {
      const file = await Deno.open("tooltip.js");
      await ctx.respond(file.readable, {
        headers: { "Content-Type": "application/javascript" },
      }).catch(logErr);
    }),
  ),
);

server.start();
