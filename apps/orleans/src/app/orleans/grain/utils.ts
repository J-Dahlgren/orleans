import { Type } from "@nestjs/common";
import { Grain } from "./Grain";
import { getGrainTypeName } from "./grain.decorator";

export function getGrainIdFromInstance<T extends object>(grain: Grain<T>) {
  const name = getGrainTypeName(grain.constructor as Type<Grain<T>>);
  return `${name}/${grain.id}`;
}

export function grainIdFromName(name: string) {
  return name.split("/")[1];
}

export function getGrainIdFromType<T extends object>(
  grain: Type<Grain<T>>,
  id: string
) {
  const name = getGrainTypeName(grain);
  return `${name}/${id}`;
}
export function getGrainId(name: string, id: string) {
  return `${name}/${id}`;
}
