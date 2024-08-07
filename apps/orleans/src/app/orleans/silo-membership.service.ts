import { Injectable, Logger } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager, In, Not } from "typeorm";
import { ORLEANS_DATASOURCE } from "./constants";
import { SiloEntity, SiloStatus } from "./SiloEntity";

function shuffleArray<T>(items: T[]) {
  const shuffled: T[] = [];
  while (items.length) {
    const index = Math.floor(Math.random() * items.length);
    shuffled.push(items.splice(index, 1)[0]);
  }
  return shuffled;
}

@Injectable()
export class MembershipService {
  siloCache: SiloEntity[] = [];
  private initialized = false;
  private logger = new Logger(MembershipService.name);
  id = 0;
  constructor(
    @InjectEntityManager(ORLEANS_DATASOURCE) private em: EntityManager
  ) {}

  setId(id: number) {
    this.initialized = true;
    this.id = id;
  }

  async updateActiveGrainCount(count: number) {
    this.em.transaction(async (em) => {
      const silo = await em.findOne(SiloEntity, {
        where: { id: this.id },
        lock: { mode: "pessimistic_write" },
      });
      if (silo) {
        silo.activeGrains = count;
        await em.save(silo);
      }
    });
  }
  async getSilo(id: number | undefined): Promise<SiloEntity | null> {
    if (id == undefined) {
      return null;
    }
    return this.em.findOne(SiloEntity, { where: { id, status: "Active" } });
  }

  async getSilos(
    statuses: SiloStatus[] = ["Created", "Joining", "Active"],
    shuffle?: boolean
  ): Promise<SiloEntity[]> {
    if (!this.initialized) {
      return [];
    }
    const silos = await this.em.find(SiloEntity, {
      where: { status: In(statuses), id: Not(this.id) },
    });

    if (!shuffle) {
      return silos;
    }
    return shuffleArray(silos);
  }
}
