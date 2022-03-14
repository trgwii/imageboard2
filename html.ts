import { elements, type HyperNodeish } from "./deps.ts";

const {
  body,
  button,
  form,
  head,
  html,
  img,
  input,
  meta,
  section,
  style,
  textarea,
  title,
} = elements;

const rule = (name: string, value: string) => `${name}: ${value};`;
const decl = (selector: string, rules: string[]) =>
  `${selector} { ${rules.join(" ")} }`;
const Style = (...decls: string[]) => style(decls.join(" "));

export const Doc = (titleStr: string, ...children: HyperNodeish[]) =>
  html(
    head(
      meta({ charset: "utf-8" }),
      meta({
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
      title(titleStr),
      Style(
        decl("div.language-id", [
          rule("display", "none"),
        ]),
        decl("body, textarea, input, select, button", [
          rule("background-color", "#181a1b"),
          rule("color", "#e8e6e3"),
          rule("border-color", "#736b5e"),
          rule("max-width", "100%"),
        ]),
        decl("a", [
          rule("color", "#3391ff"),
        ]),
      ),
    ),
    body(...children),
  );

export const CreateThreadForm = (board: string) =>
  form(
    { method: "POST", action: "/api/thread/create" },
    input({ type: "hidden", name: "board", value: board }),
    section(input({
      type: "text",
      name: "title",
      placeholder: "Thread title",
      maxlength: 256,
    })),
    section(textarea({
      name: "text",
      placeholder: "Thread text",
      maxlength: 65536,
      cols: 60,
      rows: 5,
    })),
    section(button(
      { type: "submit" },
      img({
        src: "/icons/comments_add.png",
        alt: "Create thread",
        title: "Create thread",
        width: 32,
        height: 32,
        style: "image-rendering: pixelated",
      }),
    )),
  );

export const ReplyToThreadForm = (id: number, board: string) =>
  form(
    { method: "POST", action: "/api/thread/post" },
    input({ type: "hidden", name: "id", value: String(id) }),
    input({ type: "hidden", name: "board", value: board }),
    section(textarea({
      name: "text",
      placeholder: "Reply text",
      maxlength: 65536,
      cols: 60,
      rows: 6,
    })),
    section(button(
      { type: "submit" },
      img({
        src: "/icons/comment_add.png",
        alt: "Reply to thread",
        title: "Reply to thread",
        width: 32,
        height: 32,
        style: "image-rendering: pixelated",
      }),
    )),
  );
