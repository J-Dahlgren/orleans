import { IsInt, IsString, IsUrl } from "class-validator";
import { SiloStatus } from "../SiloEntity";
import { GrainStatus } from "../grain/Grain";

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

export class SiloStatusUpdateDto {
  @IsInt()
  id!: number;

  @IsString()
  status!: SiloStatus;

  @IsUrl()
  url!: string;
}
