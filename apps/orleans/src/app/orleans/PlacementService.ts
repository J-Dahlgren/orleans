import { Inject, Injectable, Logger, Type } from "@nestjs/common";
import { orderBy, shuffle } from "lodash";
import { ORLEANS_OPTIONS } from "./constants";
import { getGrainOptions, Grain } from "./grain";
import { GrainPlacementStrategy } from "./grain/PlacementStategy";
import { IMembershipService } from "./membership/IMembershipService";
import { OrleansModuleOptions } from "./OrleansModuleOptions";
import { Silo } from "./Silo";
import { batchArray } from "./utils";

@Injectable()
export class PlacementService {
  private logger = new Logger(PlacementService.name);
  constructor(
    private membership: IMembershipService,
    @Inject(ORLEANS_OPTIONS) private ops: OrleansModuleOptions
  ) {}

  getPlacement<T extends object>(grain: Type<Grain<T>>): Silo[] {
    const defaultStrategy =
      this.ops.grainPlacementStrategy || GrainPlacementStrategy.Random;
    const grainOpts = getGrainOptions(grain);

    const grainStrategy = grainOpts.placementStrategy || defaultStrategy;
    this.logger.verbose(
      `Placement strategy for ${grain.name}: ${GrainPlacementStrategy[grainStrategy]}`
    );
    switch (grainStrategy) {
      case GrainPlacementStrategy.PreferLocal:
        return [this.membership.silo];
      case GrainPlacementStrategy.Random:
        return this.getRandomSilo();
      case GrainPlacementStrategy.ActivationCount:
        return this.getLeastLoadedSilo();
      default:
        throw new Error(`Unknown placement strategy ${grainStrategy}`);
    }
  }
  getLeastLoadedSilo(): Silo[] {
    const silos = shuffle([
      ...this.membership.getSilos(["Active"]),
      this.membership.silo,
    ]);
    return batchArray(silos, 3)
      .map((batch) => orderBy(batch, (b) => b.activations, "asc"))
      .flat();
  }
  getRandomSilo(): Silo[] {
    return shuffle([
      ...this.membership.getSilos(["Active"]),
      this.membership.silo,
    ]);
  }
}
