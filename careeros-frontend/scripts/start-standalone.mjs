import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const standaloneDir = resolve(".next/standalone");
const standaloneNextDir = resolve(standaloneDir, ".next");

mkdirSync(standaloneNextDir, { recursive: true });
cpSync(resolve(".next/static"), resolve(standaloneNextDir, "static"), { recursive: true });
cpSync(resolve("public"), resolve(standaloneDir, "public"), { recursive: true });

await import("../.next/standalone/server.js");
