import { createApp } from "../app.js";

const app = createApp() as any;
type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: Layer[] };
  regexp?: RegExp;
};

function walk(stack: Layer[], prefix = "") {
  for (const layer of stack) {
    if (layer.route) {
      const p = prefix + layer.route.path;
      for (const m of Object.keys(layer.route.methods)) console.log(`${m.toUpperCase()} ${p}`);
    } else if (layer.name === "router" && layer.handle?.stack) {
      const match = layer.regexp?.source ?? "";
      let clean = "";
      if (match.startsWith("^\\/")) {
        clean = match
          .slice(2)
          .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
          .replace(/\\\//g, "/");
      }
      walk(layer.handle.stack, `${prefix}/${clean}`.replace(/\/+/g, "/"));
    }
  }
}

walk((app.router ?? app._router).stack);
