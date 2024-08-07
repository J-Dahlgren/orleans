import { IsInt, IsString } from "class-validator";
import { SiloStatus } from "../SiloEntity";
import { GrainStatus } from "../grain/Grain";

export class GrainStatusUpdateDto {
  @IsString()
  grainType!: string;

  @IsString()
  grainId!: string;

  @IsInt()
  siloId!: number;

  @IsString()
  status!: GrainStatus;
}

export class StatusUpdateDto {
  @IsInt()
  siloId!: number;

  @IsString()
  status!: SiloStatus;
}
