import { Injectable, Type } from "@nestjs/common";
import { GrainDirector } from "../grain-director";
import { AsyncMethods, Grain } from "../grain/Grain";

export interface GrainMessage<
  T extends object,
  K extends keyof Grain<T>["methods"]
> {
  grain: Type<Grain<T>>;
  id: string;
  method: K;
  args: any[];
}

class GrainQueueMessage<T extends object, K extends keyof Grain<T>["methods"]> {
  private isFinished = false;
  private timer: NodeJS.Timeout;
  constructor(
    public grain: Type<Grain<T>>,
    public id: string,
    public method: K,
    public args: any[],
    private result: (res: null | Grain<T>["methods"][K], error?: Error) => void
  ) {
    this.timer = setTimeout(() => {
      this.isFinished = true;
      this.result(null, new Error("Timeout"));
    }, 30000);
  }

  finish(res: Grain<T>["methods"][K], error?: Error) {
    if (this.isFinished) {
      return;
    }
    clearTimeout(this.timer);
    this.isFinished = true;
    this.result(res, error);
  }
}

@Injectable()
export class ClusterClient {
  private queue: GrainQueueMessage<any, any>[] = [];

  private isProcessing = false;

  constructor(private directory: GrainDirector) {}

  getGrain<T extends object>(type: Type<Grain<T>>, id: string) {
    const target = {} as AsyncMethods<T>;
    return new Proxy(target, {
      get:
        (_, prop) =>
        (...args: any[]) =>
          this.send({ grain: type, id, method: prop as any, args }),
    });
  }

  private async send<T extends object, K extends keyof Grain<T>["methods"]>(
    msg: GrainMessage<T, K>
  ) {
    return new Promise<Grain<T>["methods"][K]>((resolve, reject) => {
      const { grain, id, method, args } = msg;
      this.queue.push(
        new GrainQueueMessage<T, K>(grain, id, method, args, (res, error) => {
          if (error || res == null) {
            reject(error);
          } else {
            resolve(res);
          }
        })
      );
      this.processQueue();
    });
  }
  private async processQueue() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const [request] = this.queue.splice(0, 1);
      const { grain, id, args, method } = request;

      try {
        const result = await this.directory.execute(grain, id, method, args);
        request.finish(result);
      } catch (error) {
        request.finish(null, error);
      }
    }
    this.isProcessing = false;
  }
}
