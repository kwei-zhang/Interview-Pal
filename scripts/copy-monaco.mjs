import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor/monaco", {recursive: true});
cpSync("node_modules/monaco-editor/min/vs", "public/vendor/monaco/vs", {recursive: true});
console.log("Monaco editor assets prepared locally.");
