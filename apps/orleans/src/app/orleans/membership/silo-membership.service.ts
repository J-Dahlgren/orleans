import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import ms from "ms";
import { networkInterfaces } from "os";
import { interval, Subscription, timer } from "rxjs";
import { EntityManager, In, Not } from "typeorm";
import { ORLEANS_DATASOURCE } from "../constants";
import { LocalDirectory } from "../directory";
import { EventBus } from "../event";
import { SiloStatusUpdateDto } from "../messaging/dto";
import { Silo } from "../Silo";
import { SiloEntity, SiloStatus } from "../SiloEntity";

import { shuffle } from "lodash";
import { IMembershipService } from "./IMembershipService";

@Injectable()
export class MembershipService
  implements IMembershipService, OnModuleInit, OnModuleDestroy
{
  private subs: Subscription[] = [];
  private _silo!: Silo;
  get silo(): Silo {
    if (!this._silo) {
      throw new Error("Silo not initialized");
    }

    return { ...this._silo, activations: this.directory.size };
  }

  private logger = new Logger(MembershipService.name);
  private siloCache = new Map<number, Silo>();

  constructor(
    @InjectEntityManager(ORLEANS_DATASOURCE) private em: EntityManager,
    eventBus: EventBus,
    private directory: LocalDirectory
  ) {
    eventBus.register(SiloStatusUpdateDto, (silo) =>
      this.onSiloStatusUpdate(silo)
    );
  }

  activationCountChanged(): boolean {
    return this._silo.activations !== this.directory.size;
  }

  onSiloStatusUpdate(silo: SiloStatusUpdateDto): void {
    this.siloCache.set(silo.id, silo);
  }

  setStatus(status: SiloStatus): Promise<void> {
    return this.em.transaction(async (em) => {
      const silo = await em.findOne(SiloEntity, {
        where: { id: this.silo.id },
        lock: { mode: "pessimistic_write" },
      });
      if (silo) {
        silo.status = status;
        silo.activations = this.directory.size;
        this._silo = (await em.save(silo)).toSilo();
      }
    });
  }

  async getSilo(id: number): Promise<Silo | null> {
    return this.siloCache.get(id) || null;
  }

  getSilos(
    statuses: SiloStatus[] = ["Created", "Joining", "Active"],
    shuffleItems?: boolean
  ): Silo[] {
    const silos = [...this.siloCache.values()].filter((s) =>
      statuses.includes(s.status)
    );

    if (!shuffleItems) {
      return silos;
    }
    return shuffle(silos);
  }

  private async updateSiloCache() {
    const silos = await this.em.find(SiloEntity, {
      where: {
        status: In([
          "Created",
          "Joining",
          "Active",
          "Stopping",
        ] satisfies SiloStatus[]),
        id: Not(this.silo.id),
      },
    });

    const values = [...this.siloCache.values()];
    values
      .filter((s) => !silos.find((s2) => s2.id === s.id))
      .forEach((s) => this.siloCache.delete(s.id));
    for (const silo of silos) {
      const existing = this.siloCache.get(silo.id);
      this.siloCache.set(silo.id, {
        ...silo.toSilo(),
        activations: existing?.activations || silo.activations,
      });
    }
  }

  async updateActivationCount() {
    if (!this.activationCountChanged()) {
      return;
    }
    this.em.transaction(async (em) => {
      const silo = await em.findOne(SiloEntity, {
        where: { id: this.silo.id },
        lock: { mode: "pessimistic_write" },
      });
      if (silo) {
        silo.activations = this.directory.size;
        await em.save(silo);
      }
    });
  }

  async onModuleInit() {
    const ip = this.getIp();
    const entity = this.em.create(SiloEntity, {
      ip,
      port: parseInt(process.env.PORT || "3000"),
    });

    const silo = await this.em.save(entity);
    this._silo = silo.toSilo();
    this.logger.log(`Silo ${silo.id} is running on ${this.silo.url}`);
    this.subs.push(
      timer(0, ms("10s")).subscribe(() => this.updateSiloCache()),
      interval(ms("10s")).subscribe(() => this.updateActivationCount())
    );

    this.em.transaction(async (em) => {
      const duplicated = await em.find(SiloEntity, {
        where: {
          status: Not("Stopped" as SiloStatus),
          id: Not(this.silo.id),
          port: entity.port,
          ip: entity.ip,
        },
      });
      if (duplicated.length > 0) {
        this.logger.warn(
          `${duplicated.length} silos are running on the same IP and port, marking them as stopped`
        );
      }
      for (const silo of duplicated) {
        silo.status = "Stopped";
        silo.activations = 0;
      }
      await em.save(duplicated);
    });
  }

  onModuleDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private getIp() {
    const nets = networkInterfaces();
    const ipAdresses: string[] = [];
    const netNames = ["Ethernet", "Eth0"];
    for (const name of Object.keys(nets)) {
      if (!nets[name] || !netNames.includes(name)) {
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
