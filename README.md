# Forum

## Running

```sh
rm -r node_modules package-lock.json vendor
deno vendor --force https://deno.land/x/hyperactive@v2.0.0-alpha.12/mod.ts
deno vendor --force https://deno.land/x/hyperactive@v2.0.0-alpha.12/serve.ts
deno eval "const p = 'vendor/deno.land/x/hyperactive@v2.0.0-alpha.12/serve/core.ts';await Deno.writeTextFile(p, (await Deno.readTextFile(p)).replace('handler(ctx, () => h404(ctx, noop))', 'handler(ctx, () => h404(ctx, noop)).catch(console.error)'));"
npm i
deno run --watch --allow-write=threads --allow-read=threads,tooltip.js --allow-net=127.0.0.1:8080 --allow-run=node --unstable run.ts
```

## IP-based IDs

- Be able to view who posted what inside a single thread without sacrificing
  anonymity.
- Reduce the risk of impersonation.
- Rate limiting

### Secondary ideas

- Make thread ID part of the hash, so you can only see which posts are by the
  same person within one thread, not across the entire site.
