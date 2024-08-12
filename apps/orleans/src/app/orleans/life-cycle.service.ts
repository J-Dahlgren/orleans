import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { GrainDirector } from "./GrainDirector";
import { IMembershipService } from "./membership/IMembershipService";
import { BroadcastService } from "./messaging/broadcast.service";
import { SiloStatus } from "./SiloEntity";

@Injectable()
export class LifeCycleService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private logger = new Logger(LifeCycleService.name);
  constructor(
    private broadcastService: BroadcastService,
    private directoryService: GrainDirector,
    private membershipService: IMembershipService
  ) {}

  async beforeApplicationShutdown() {
    this.logger.debug("Stopping");
    await this.setStatus("Stopping");
    await this.directoryService.deactivateGrains();
    await this.setStatus("Stopped");
    this.logger.debug("Stopped");
  }

  async onApplicationBootstrap() {
    await this.setStatus("Joining");
  }

  async afterAppListen() {
    await this.setStatus("Active");
  }

  private async setStatus(status: SiloStatus) {
    await this.membershipService.setStatus(status);
    await this.broadcastService.updateStatus(status);
  }
}
