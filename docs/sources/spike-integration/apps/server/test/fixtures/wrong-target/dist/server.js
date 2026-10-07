import { Injectable, Module } from "@nestjs/common";
import { CommandValidator } from "@northmes/sdk";
class V { async check(input) { return undefined; } }
CommandValidator("planning.rescheduleEverything", { timeoutMs: 100 })(V.prototype, "check", Object.getOwnPropertyDescriptor(V.prototype, "check"));
Injectable()(V);
class M {}
Module({ providers: [V] })(M);
export default M;
