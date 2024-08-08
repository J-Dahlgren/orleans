import { forwardRef, Inject, Injectable, Type } from "@nestjs/common";
import { GrainDirector } from "../GrainDirector";
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

export interface ClusterProperties {
  id: string;
  factory: ClusterClient;
}

@Injectable()
export class ClusterClient {
  constructor(
    @Inject(forwardRef(() => GrainDirector)) private director: GrainDirector
  ) {}

  getGrain<T extends object>(type: Type<Grain<T>>, id: string) {
    const target = {} as AsyncMethods<T> & { cluster: ClusterProperties };
    const clusterData = { clustedId: id, factory: this };
    return new Proxy(target, {
      get: (_, prop) => {
        if (prop === "cluster") {
          return clusterData;
        }
        return (...args: any[]) =>
          this.send({ grain: type, id, method: prop as any, args });
      },
    });
  }

  private async send<T extends object, K extends keyof Grain<T>["methods"]>(
    msg: GrainMessage<T, K>
  ) {
    const { grain, id, method, args } = msg;
    return await this.director.execute(grain, id, method, args);
  }
}
