import { Type } from "@nestjs/common";
import { Grain } from "./grain";
import { GrainPlacementStrategy } from "./grain/PlacementStategy";

export interface OrleansModuleOptions {
  grainTypes: Type<Grain>[];
  grainPlacementStrategy?: GrainPlacementStrategy;
}
