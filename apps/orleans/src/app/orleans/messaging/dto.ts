import { IsInt, IsString, IsUrl } from "class-validator";
import { GrainStatus } from "../grain/Grain";
import type { Silo } from "../Silo";
import { SiloStatus } from "../SiloEntity";

export class GrainStatusUpdateDto {
  @IsString()
  grainType!: string;

  @IsString()
  grainId!: string;

  @IsInt()
  siloId!: number;

  @IsUrl()
  url!: string;

  @IsString()
  status!: GrainStatus;
}

export class SiloStatusUpdateDto implements Silo {
  @IsInt()
  id!: number;

  @IsString()
  status!: SiloStatus;

  @IsUrl()
  url!: string;

  @IsInt()
  activations!: number;
}
