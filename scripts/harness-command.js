#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const commandsDir = path.join(root, ".claude", "commands");

function listCommands() {
  if (!fs.existsSync(commandsDir)) {
    console.error(`Commands directory not found: ${commandsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(commandsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/i, ""))
    .sort();

  console.log("Available harness commands:");
  for (const file of files) {
    console.log(`- ${file}`);
  }
}

function renderCommand(commandName, taskText) {
  const filePath = path.join(commandsDir, `${commandName}.md`);
  if (!fs.existsSync(filePath)) {
    console.error(`Command not found: ${commandName}`);
    console.error(`Expected file: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const rendered = raw.replace(/\$ARGUMENTS/g, taskText || "(no task provided)");
  console.log(rendered);
}

const [, , arg1, ...rest] = process.argv;

if (!arg1 || arg1 === "--list" || arg1 === "list" || arg1 === "help" || arg1 === "--help") {
  listCommands();
  process.exit(0);
}

const commandName = arg1;
const taskText = rest.join(" ").trim();
renderCommand(commandName, taskText);
