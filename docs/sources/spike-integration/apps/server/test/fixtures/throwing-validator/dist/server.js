import { Injectable, Module } from "@nestjs/common";
import { CommandValidator } from "@northmes/sdk";
class V { async check(input) { throw new Error("validator bug: db password=hunter2"); } }
CommandValidator("planning.releaseProductionOrder", { timeoutMs: 100 })(V.prototype, "check", Object.getOwnPropertyDescriptor(V.prototype, "check"));
Injectable()(V);
class M {}
Module({ providers: [V] })(M);
export default M;
