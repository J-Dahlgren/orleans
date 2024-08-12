import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { SiloStatus } from "../SiloEntity";

import ms from "ms";
import { filter, interval, Subscription } from "rxjs";
import { IMembershipService } from "../membership/IMembershipService";
import { Silo } from "../Silo";
import { batchArray } from "../utils";
import { broadcastConstants } from "./constants";
import { GrainStatusUpdateDto, SiloStatusUpdateDto } from "./dto";

export interface StatusUpdate {
  siloId: number;
  status: SiloStatus;
}

@Injectable()
export class BroadcastService
  implements OnModuleDestroy, OnApplicationBootstrap
{
  private logger = new Logger(BroadcastService.name);
  private sub!: Subscription;
  constructor(private membershipService: IMembershipService) {}
  onApplicationBootstrap() {
    this.sub = interval(ms("10s"))
      .pipe(filter(() => this.membershipService.activationCountChanged()))
      .subscribe(() => this.publishActivationCount());
  }
  async publishActivationCount() {
    const message: SiloStatusUpdateDto = {
      ...this.membershipService.silo,
    };
    await this.broadcast(message, broadcastConstants.siloStatus);
  }
  onModuleDestroy() {
    this.sub.unsubscribe();
  }

  async broadcast<T extends object>(data: T, path: string) {
    const silos = this.membershipService.getSilos(["Active"], true);
    for (const silosBatch of batchArray(silos, 10)) {
      await Promise.all(
        silosBatch.map((silo) => this.broadcastToSilo(silo, data, path))
      );
    }
  }
  private async broadcastToSilo<T extends object>(
    silo: Silo,
    data: T,
    path: string
  ) {
    try {
      const response = await fetch(`${silo.url}/orleans/broadcast/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const responseJson = await response.json();
        this.logger.error(
          `Failed to broadcast ${path} data: ${JSON.stringify(
            data,
            null,
            2
          )} to silo ${silo.id}: ${response.status} ${JSON.stringify(
            responseJson,
            null,
            2
          )}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to broadcast data to silo ${silo.id}: ${error}`
      );
    }
  }

  async updateStatus(status: SiloStatus) {
    const silo = this.membershipService.silo;
    const message: SiloStatusUpdateDto = {
      ...silo,
      status,
    };
    await this.broadcast(message, broadcastConstants.siloStatus);
  }

  async updateGrainStatus(data: Omit<GrainStatusUpdateDto, "siloId">) {
    await this.broadcast(
      { ...data, siloId: this.membershipService.silo.id },
      broadcastConstants.grainStatus
    );
  }
}
