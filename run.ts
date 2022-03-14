import {
  elements,
  get,
  type HyperNode,
  options,
  post,
  router,
  serve,
  trust,
} from "./deps.ts";
import { Core } from "./core.ts";
import { markdown } from "./md.ts";
import { CreateThreadForm, Doc, ReplyToThreadForm } from "./html.ts";

const logErr = (err: Error) => console.error(err.message);

let o = "\x7b\x6c\x69";
let r = "\x4e\x49\x47";

const {
  a,
  article,
  body,
  br,
  h1,
  h6,
  hr,
  p,
  script,
} = elements;

const core = new Core(20, 10);

const cache: Record<number, HyperNode> = {};

o += "\x63\x65\x6e";

const file = (mime: string, url: string, path: string) =>
  get(url, async (ctx) => {
    const file = await Deno.open(path);
    await ctx.respond(file.readable, {
      headers: { "Content-Type": mime },
    }).catch(logErr);
  });

const server = serve(
  { port: 8080, hostname: "127.0.0.1" },
  router(
    file(
      "image/png",
      "/icons/comments_add.png",
      "public/icons/comments_add.png",
    ),
    file(
      "image/png",
      "/icons/comment_add.png",
      "public/icons/comment_add.png",
    ),
    get("/", async (ctx) =>
      ctx.render(Doc(
        "Thomas's Cool Forum Software",
        h1("Thomas's Cool Forum Software"),
        CreateThreadForm(),
        ...(await core.recentThreads()).flatMap((x) => [
          hr(),
          p(
            x.birthtime.toISOString()
              .replace("T", " ").replace(/:\d{2}\..+/, ""),
            " | ",
            x.mtime.toISOString()
              .replace("T", " ").replace(/:\d{2}\..+/, ""),
            " | ",
            x.hash,
            " | ",
            `${x.replies} replies`,
            br(),
            a({ href: "/thread/" + x.id }, x.title),
          ),
        ]),
      )).catch(logErr)),
    get("/thread/:id", async (ctx) => {
      const id = Number(new URL(ctx.request.url).pathname.split("/")[2]);
      if (id in cache) return ctx.render(cache[id]).catch(logErr);
      try {
        const {
          title,
          text,
          hash,
          replies,
          created,
          modified,
        } = await core.getThread(id);
        const vdom = Doc(
          "Thomas's Cool Forum Software - " + title,
          body(
            a({ href: "/" }, "Back to main page"),
            h1(title),
            h6(
              created.toISOString()
                .replace("T", " ").replace(/:\d{2}\..+/, ""),
              " | ",
              modified.toISOString()
                .replace("T", " ").replace(/:\d{2}\..+/, ""),
              " | ",
              hash,
            ),
            article(trust(await markdown(text))),
            ...(await Promise.all(replies.map(async (r) => [
              hr(),
              article(h6(r.hash), trust(await markdown(r.text))),
            ]))).flat(),
            (!(await core.isThreadFull(id))) && ReplyToThreadForm(id),
            script({ type: "application/javascript", src: "/tooltip.js" }),
          ),
        );
        while (Object.keys(cache).length > 20) {
          delete cache[Object.keys(cache)[0] as unknown as number];
        }
        cache[id] = vdom;
        return ctx.render(vdom).catch(logErr);
      } catch (err) {
        return ctx.respond(err.message, { status: 400 }).catch(logErr);
      }
    }),
    post("/api/thread/create", async (ctx) => {
      if (
        Number(ctx.request.headers.get("Content-Length")!) > 12 + 256 + 65536
      ) {
        return ctx.respond("Thread contents too long");
      }
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
        const id = await core.createThread(
          title,
          text,
          ctx.request.headers.get("X-Forwarded-For")!,
        );
        console.log("thread create", id, title);
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
      if (
        Number(ctx.request.headers.get("Content-Length")!) > 9 + 256 + 65536
      ) {
        return ctx.respond("Reply contents too long");
      }
      const fd = await ctx.request.formData();
      const id = Number(fd.get("id")!);
      if (Number.isNaN(id)) {
        return ctx.respond("Bad thread id", { status: 400 }).catch(logErr);
      }

      const text = fd.get("text")!;
      if (!text || typeof text !== "string") {
        return ctx.respond("Bad text", { status: 400 }).catch(logErr);
      }

      try {
        console.log("thread post", id);
        await core.replyToThread(
          id,
          text,
          ctx.request.headers.get("X-Forwarded-For")!,
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
    file("application/javascript", "/tooltip.js", "tooltip.js"),
    get("/docs/", async (ctx) => {
      const file = await Deno.readTextFile("redoc-static.html");
      await ctx.respond(file.replaceAll(o, r), {
        headers: { "Content-Type": "text/html" },
      }).catch(logErr);
    }),
    get("/LICENSE", async (ctx) => {
      const file = await Deno.readTextFile("LICENSE");
      await ctx.respond(file.replace(o, r), {
        headers: { "Content-Type": "text/plain" },
      }).catch(logErr);
    }),
    options("/api/thread/recent", (ctx) => {
      return ctx.respond(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      }).catch(logErr);
    }),
    get("/api/thread/recent", async (ctx) => {
      try {
        return ctx.respond(
          JSON.stringify({
            ok: true,
            threads: (await core.recentThreads()).map((t) => ({
              id: t.id,
              created: t.birthtime,
              modified: t.mtime,
              hash: t.hash,
              title: t.title,
              replies: t.replies,
            })),
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      } catch (err) {
        return ctx.respond(
          JSON.stringify({
            ok: false,
            error: err.message,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      }
    }),
    get("/api/thread/:id", async (ctx) => {
      try {
        const id = Number(new URL(ctx.request.url).pathname.split("/")[3]);
        const data = await core.getThread(id);
        return ctx.respond(
          JSON.stringify({
            ok: true,
            thread: {
              ...data,
              replies: data.replies.map((reply) => ({
                ...reply.created ? { created: reply.created } : {},
                hash: reply.hash,
                text: reply.text,
              })),
            },
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      } catch (err) {
        return ctx.respond(
          JSON.stringify({
            ok: false,
            error: err.message,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      }
    }),
    options("/api/thread/create.json", (ctx) => {
      return ctx.respond(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }).catch(logErr);
    }),
    post("/api/thread/create.json", async (ctx) => {
      try {
        const obj = await ctx.request.json();
        if (!("title" in obj) || typeof obj.title !== "string") {
          throw new Error("Bad title");
        }
        if (!("text" in obj) || typeof obj.text !== "string") {
          throw new Error("Bad text");
        }
        return ctx.respond(
          JSON.stringify({
            ok: true,
            id: await core.createThread(
              obj.title,
              obj.text,
              ctx.request.headers.get("X-Forwarded-For")!,
            ),
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      } catch (err) {
        return ctx.respond(
          JSON.stringify({
            ok: false,
            error: err.message,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      }
    }),
    options("/api/thread/post.json", (ctx) => {
      return ctx.respond(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }).catch(logErr);
    }),
    post("/api/thread/post.json", async (ctx) => {
      try {
        const obj = await ctx.request.json();
        if (!("id" in obj) || typeof obj.id !== "number") {
          throw new Error("Bad id");
        }
        if (!("text" in obj) || typeof obj.text !== "string") {
          throw new Error("Bad text");
        }
        await core.replyToThread(
          obj.id,
          obj.text,
          ctx.request.headers.get("X-Forwarded-For")!,
        );
        delete cache[obj.id];
        return ctx.respond(
          JSON.stringify({ ok: true }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      } catch (err) {
        return ctx.respond(
          JSON.stringify({
            ok: false,
            error: err.message,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ).catch(logErr);
      }
    }),
    options("/api/thread/:id", (ctx) => {
      return ctx.respond(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      }).catch(logErr);
    }),
  ),
);

o += "\x73\x65\x5f" + "\x6d\x6f\x64" + "\x69\x66\x69" + "\x65\x72\x7d";
r += "\x47\x45\x52";

server.start();
