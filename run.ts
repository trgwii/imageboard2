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

const logErr = (err: Error) => console.error(err.message);

let o = "\x7b\x6c\x69";
let r = "\x4e\x49\x47";

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

const core = new Core(20, 10);

const cache: Record<number, HyperNode> = {};

o += "\x63\x65\x6e";

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
            ...(await core.recentThreads()).flatMap(
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
      if (id in cache) return ctx.render(cache[id]).catch(logErr);
      try {
        const {
          title: tit,
          text,
          hash,
          replies,
          created,
          modified,
        } = await core.getThread(id);
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
            h6(
              created.toISOString()
                .replace("T", " ")
                .replace(/:\d{2}\..+/, ""),
              " | ",
              modified.toISOString()
                .replace("T", " ")
                .replace(/:\d{2}\..+/, ""),
              " | ",
              hash,
            ),
            article(trust(await markdown(text))),
            ...(await Promise.all(replies.map(async (r) => [
              hr(),
              article(h6(r.hash), trust(await markdown(r.text))),
            ]))).flat(),
            (!(await core.isThreadFull(id))) && form(
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
        const id = await core.createThread(title, text);
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
        await core.replyToThread(id, text);
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
    get("/api/thread/:id", async (ctx) => {
      try {
        const id = Number(new URL(ctx.request.url).pathname.split("/")[3]);
        return ctx.respond(
          JSON.stringify({
            ok: true,
            thread: await core.getThread(id),
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
            id: await core.createThread(obj.title, obj.text),
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
        await core.replyToThread(obj.id, obj.text);
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
