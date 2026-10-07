import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule, defaultModules, type EnabledModule } from "./app.module.js";

export async function bootstrap(port = Number(process.env.PORT ?? 4000), mods?: EnabledModule[]) {
  process.env.PORT = String(port);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(mods ?? defaultModules()), {
    logger: process.env.SPIKE_LOG ? ["log", "error", "warn"] : ["error", "warn"],
    bodyParser: process.env.SPIKE_BODY_PARSER !== "0",
  });
  await app.listen(port, "127.0.0.1");
  return app;
}

if (process.argv[1]?.endsWith("main.js")) {
  const t0 = performance.now();
  bootstrap().then(
    async (app) => {
      console.log(`listening on ${process.env.PORT ?? 4000} mode=${process.env.SUBGRAPH_MODE ?? "inproc"}`);
      if (process.env.SPIKE_EXIT_AFTER_BOOT === "1") {
        const { GatewayService } = await import("./gateway/gateway.module.js");
        const gw = app.get(GatewayService);
        const names = gw.collectSubgraphs().map((s) => s.name).join(",");
        console.log(`subgraphs=${names}`);
        console.log(`supergraph has Article.helloGreeting=${/helloGreeting/.test(gw.supergraphSdl ?? "")}`);
        console.log(`boot_ms=${Math.round(performance.now() - t0)} rss_mb=${Math.round(process.memoryUsage().rss / 1e6)}`);
        await app.close();
        process.exit(0);
      }
    },
    (err) => {
      console.error(err?.stack ?? err);
      process.exit(1);
    },
  );
}
