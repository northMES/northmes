import { Injectable, Module } from "@nestjs/common";
import { CommandValidator } from "@northmes/sdk";
class V { async check(input) { await new Promise((r) => setTimeout(r, 3000)); return undefined; } }
CommandValidator("planning.releaseProductionOrder", { timeoutMs: 100 })(V.prototype, "check", Object.getOwnPropertyDescriptor(V.prototype, "check"));
Injectable()(V);
class M {}
Module({ providers: [V] })(M);
export default M;
