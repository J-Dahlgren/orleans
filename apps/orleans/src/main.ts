import {
  Logger,
  RequestMethod,
  ShutdownSignal,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cluster from "cluster";
import { AppModule } from "./app/app.module";
import { LifeCycleService } from "./app/orleans/life-cycle.service";

export async function bootstrap(port = "3000", useShutdownHooks = true) {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = "api";
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      {
        path: "orleans(.*)",
        method: RequestMethod.ALL,
      },
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (useShutdownHooks) {
    app.enableShutdownHooks([ShutdownSignal.SIGINT, ShutdownSignal.SIGTERM]);
  }
  const options = new DocumentBuilder()
    .setTitle(`Orleans API`)
    .setVersion(`1.0`)

    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, options, {});
  SwaggerModule.setup("swagger", app, swaggerDocument);

  await app.listen(port);
  await app.get(LifeCycleService).afterAppListen();
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );

  return app;
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
if (process.env.LOCAL_CLUSTERING === "true") {
  setupCluster();
} else {
  bootstrap();
}

async function setupCluster() {
  if (cluster.isPrimary) {
    const workerCount = 3;
    for (let i = 0; i < workerCount; i++) {
      await sleep(1000);

      setupWorker(`${3000 + i}`, i === 0 ? "true" : "false");
    }
    if (process.env.SIMULATE_SILO_SHUTDOWN === "true") {
      let killCounter = 0;
      setInterval(() => {
        Logger.debug(`Killing worker ${killCounter % workerCount}`);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const worker = Object.values(cluster.workers!)[
          killCounter % workerCount
        ];
        if (worker) {
          Logger.log(`Killing worker ${killCounter % workerCount}`);
          worker.send("shutdown");
          killCounter++;
        }
      }, 10000);
    }
  } else if (cluster.isWorker) {
    const app = await bootstrap(process.env.PORT, false);
    process.on("message", async (msg) => {
      if (msg === "shutdown") {
        await app.close();
        process.exit(0);
      }
    });
  }
}

function setupWorker(PORT: string, DROP_DATABASE = "false") {
  const worker = cluster.fork({ PORT, DROP_DATABASE });
  worker.on("exit", () => {
    Logger.debug(`Worker ${worker.process.pid} died`);
    setTimeout(() => {
      setupWorker(PORT);
    }, 2000);
  });
}
