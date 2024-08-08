import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { interval } from "rxjs";
import { TestGrain } from "./TestGrain";
import { ClusterClient } from "./orleans/messaging/cluster-client";

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private logger = new Logger(AppService.name);
  constructor(private client: ClusterClient) {}

  id = 1;
  counter = 1;
  private async increment(id: number) {
    const grain = this.client.getGrain(TestGrain, this.id.toString());
    try {
      const result = await grain.increment();
      if (result === 10) {
        this.counter += 10;
        this.logger.warn(`Got 10 from grain ${id}, skipping ahead`);
      }
      this.counter++;
      this.id = Math.floor(this.counter / 10) + 1;
    } catch (error) {
      this.logger.error(error);
    }
  }

  onApplicationBootstrap() {
    interval(500).subscribe((v) => this.increment(v));
  }
}
