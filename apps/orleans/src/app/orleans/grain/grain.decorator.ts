import { Injectable, Scope, Type } from "@nestjs/common";
import { Grain } from "./Grain";
import { GrainPlacementStrategy } from "./PlacementStategy";

export interface GrainOptions {
  placementStrategy?: GrainPlacementStrategy;
}
export const GrainMetadataKey = "grain";
export function DefineGrain(opts: GrainOptions = {}): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(GrainMetadataKey, opts, target);
    Injectable({ scope: Scope.TRANSIENT })(target);
    return;
  };
}

export function getGrainTypeName<T extends object>(
  target: Type<Grain<T>>
): string {
  return target.name;
}

export function getGrainOptions<T extends object>(
  target: Type<Grain<T>>
): GrainOptions {
  if (!Reflect.hasMetadata(GrainMetadataKey, target)) {
    throw new Error("Grain options not defined");
  }
  return Reflect.getMetadata(GrainMetadataKey, target);
}
