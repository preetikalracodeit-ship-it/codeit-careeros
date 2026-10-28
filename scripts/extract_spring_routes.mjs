import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "careeros-backend", "src", "main", "java");
const output = path.join(root, "docs", "mern-api-route-inventory.csv");
const methodNames = {
  GetMapping: "GET",
  PostMapping: "POST",
  PutMapping: "PUT",
  PatchMapping: "PATCH",
  DeleteMapping: "DELETE",
};

async function javaFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javaFiles(entryPath);
    return entry.isFile() && entry.name.endsWith("Controller.java") ? [entryPath] : [];
  }));
  return nested.flat();
}

function annotationArgs(source, start) {
  let open = source.indexOf("Mapping", start) + "Mapping".length;
  while (/\s/.test(source[open] || "")) open += 1;
  if (source[open] !== "(") return ["", open];
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) return [source.slice(open + 1, index), index + 1];
    }
  }
  return [source.slice(open + 1), source.length];
}

function pathsIn(args) {
  const values = [...args.matchAll(/["']([^"']*)["']/g)].map((match) => match[1]);
  const paths = values.filter((value) => value.startsWith("/"));
  return paths.length ? paths : [""];
}

function joinPath(base, child) {
  const combined = [base.replace(/^\/|\/$/g, ""), child.replace(/^\/|\/$/g, "")]
    .filter(Boolean)
    .join("/");
  return `/${combined}`;
}

function routesFor(source, controller) {
  let classBase = "";
  for (const match of source.matchAll(/@RequestMapping\b/g)) {
    const [args, end] = annotationArgs(source, match.index);
    if (/\bclass\s+\w+/.test(source.slice(end, end + 500))) {
      classBase = pathsIn(args)[0];
      break;
    }
  }

  const rows = [];
  const skipped = [];
  const annotationPattern = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\b/g;
  for (const match of source.matchAll(annotationPattern)) {
    const annotation = match[1];
    const [args, end] = annotationArgs(source, match.index);
    const following = source.slice(end, end + 1500);
    const handler = following.match(/\b(?:public|protected|private)\s+[\w<>?,. \[\]]+\s+(\w+)\s*\(/);
    if (!handler) {
      skipped.push(`${controller}: ${source.slice(match.index, end + 180).replaceAll("\n", " ")}`);
      continue;
    }
    const methods = annotation === "RequestMapping"
      ? [...args.matchAll(/RequestMethod\.(GET|POST|PUT|PATCH|DELETE)/g)].map((item) => item[1])
      : [methodNames[annotation]];
    const resolvedMethods = methods.length ? methods : ["ANY"];
    for (const child of pathsIn(args)) {
      if (annotation === "RequestMapping" && child === classBase) continue;
      for (const method of resolvedMethods) {
        rows.push({ method, path: joinPath(classBase, child), controller, handler: handler[1] });
      }
    }
  }
  return { rows, skipped };
}

const files = await javaFiles(sourceRoot);
const rows = [];
const skipped = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const found = routesFor(source, path.basename(file, ".java"));
  rows.push(...found.rows);
  skipped.push(...found.skipped);
}
rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method) || a.controller.localeCompare(b.controller));
const csv = [
  "method,path,controller,handler",
  ...rows.map((row) => [row.method, row.path, row.controller, row.handler].map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")),
].join("\n") + "\n";
await writeFile(output, csv, "utf8");
console.log(`Wrote ${rows.length} route declarations to ${path.relative(root, output)}`);
if (skipped.length) console.warn(`Could not map ${skipped.length} declarations:\n${skipped.join("\n")}`);
