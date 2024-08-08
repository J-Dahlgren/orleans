import { Type } from "@nestjs/common";
import { Grain } from "./Grain";

export interface GrainOptions {
  name: string;
}
export const GrainMetadataKey = "grain:name";
export function DefineGrain(opts: GrainOptions): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(GrainMetadataKey, opts.name, target);
    return;
  };
}

export function getGrainMetadata<T extends object>(
  target: Type<Grain<T>>
): string {
  if (!Reflect.hasMetadata(GrainMetadataKey, target)) {
    throw new Error("Grain name not defined");
  }
  return Reflect.getMetadata(GrainMetadataKey, target);
}
