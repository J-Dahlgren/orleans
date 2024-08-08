import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
} from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { networkInterfaces } from "os";
import { EntityManager } from "typeorm";
import { ORLEANS_DATASOURCE } from "./constants";
import { GrainDirector } from "./GrainDirector";
import { BroadcastService } from "./messaging/broadcast.service";
import { MembershipService } from "./silo-membership.service";
import { SiloEntity, SiloStatus } from "./SiloEntity";

@Injectable()
export class LifeCycleService
  implements OnModuleInit, OnApplicationBootstrap, BeforeApplicationShutdown
{
  private silo!: SiloEntity;
  private logger = new Logger(LifeCycleService.name);
  constructor(
    @InjectEntityManager(ORLEANS_DATASOURCE) private em: EntityManager,
    private broadcastService: BroadcastService,
    private directoryService: GrainDirector,
    private membershipService: MembershipService
  ) {}

  get id() {
    return this.silo.id;
  }

  async onModuleInit() {
    await this.createSilo();
    this.logger.log(
      `Silo ${this.silo.id} is running on ${this.silo.ip}:${this.silo.port}`
    );
  }
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
  private async createSilo() {
    const ip = this.getIp();
    const entity = this.em.create(SiloEntity, {
      ip,
      port: parseInt(process.env.PORT || "3000"),
    });
    this.silo = await this.em.save(entity);
    this.membershipService.setSilo(this.silo);
  }
  async afterAppListen() {
    await this.setStatus("Active");
  }

  private async setStatus(status: SiloStatus) {
    await this.em.transaction(async (em) => {
      this.logger.debug(`Setting status to ${status}`);
      const silo = await em.findOneOrFail(SiloEntity, {
        where: { id: this.silo.id },
        lock: { mode: "pessimistic_write" },
      });
      silo.status = status;
      await em.save(silo);
    });
    await this.broadcastService.updateStatus(status);
  }

  private getIp() {
    const nets = networkInterfaces();
    const ipAdresses: string[] = [];
    for (const name of Object.keys(nets)) {
      if (!nets[name] || name !== "Ethernet") {
        continue;
      }

      for (const netInfo of nets[name]) {
        // skip over non-ipv4 and internal (i.e. 127.0.0.1) addresses

        if (netInfo.family === "IPv4" && !netInfo.internal) {
          ipAdresses.push(netInfo.address);
        }
      }
    }
    return ipAdresses[0];
  }
}
