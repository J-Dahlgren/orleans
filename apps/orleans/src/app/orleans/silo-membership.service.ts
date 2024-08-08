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
  private initialized = false;

  private logger = new Logger(MembershipService.name);
  id = 0;

  private _silo!: SiloEntity;

  get silo() {
    return this._silo;
  }

  constructor(
    @InjectEntityManager(ORLEANS_DATASOURCE) private em: EntityManager
  ) {}

  setSilo(silo: SiloEntity) {
    this.initialized = true;
    this.id = silo.id;
    this._silo = silo;
  }

  async updateActiveGrainCount(count: number) {
    this.em.transaction(async (em) => {
      const silo = await em.findOne(SiloEntity, {
        where: { id: this.id },
        lock: { mode: "pessimistic_write" },
      });
      if (silo) {
        silo.activeGrains = count;
        const result = await em.save(silo);
        this._silo = result;
      }
    });
  }
  async getSilo(id: number): Promise<SiloEntity | null> {
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
