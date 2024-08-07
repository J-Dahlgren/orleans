import { Injectable, Logger } from "@nestjs/common";
import { SiloStatus } from "../SiloEntity";
import { MembershipService } from "../silo-membership.service";

import { broadcastConstants } from "./constants";
import { GrainStatusUpdateDto, StatusUpdateDto } from "./dto";

export interface StatusUpdate {
  siloId: number;
  status: SiloStatus;
}

@Injectable()
export class BroadcastService {
  logger = new Logger(BroadcastService.name);

  constructor(private membershipService: MembershipService) {}

  async broadcast<T extends object>(data: T, path: string) {
    const silos = await this.membershipService.getSilos(["Active"]);
    for (const silo of silos) {
      try {
        await fetch(
          `http://${silo.ip}:${silo.port}/orleans/broadcast/${path}`,
          {
            method: "POST",
            body: JSON.stringify(data),
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to broadcast data to silo ${silo.id}: ${error}`
        );
      }
    }
  }

  async updateStatus(status: SiloStatus) {
    const message: StatusUpdateDto = {
      status,
      siloId: this.membershipService.id,
    };
    await this.broadcast(message, broadcastConstants.siloStatus);
  }

  async updateGrainStatus(data: Omit<GrainStatusUpdateDto, "siloId">) {
    await this.broadcast(
      { ...data, siloId: this.membershipService.id },
      broadcastConstants.grainStatus
    );
  }
}
