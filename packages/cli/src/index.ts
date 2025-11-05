#!/usr/bin/env bun
import { Command } from "commander";
import { buildCallCommand } from "./commands/call";

const program = new Command()
  .name("poc")
  .description("Proof-of-Concept CLI for calling external APIs (headers/args) with clean architecture");

program.addCommand(buildCallCommand());

program.parseAsync().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
