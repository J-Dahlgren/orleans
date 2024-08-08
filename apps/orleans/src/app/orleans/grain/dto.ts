import { IsArray, IsString } from "class-validator";
import { GrainMethods } from "./Grain";

export class CreateGrainDto {
  @IsString()
  type!: string;
  @IsString()
  id!: string;
}
export interface SuccessResponse {
  success: boolean;
}
export interface FindGrainResponse {
  success: boolean;
}

export class ExecuteGrainMethodDto<
  T extends object,
  K extends keyof GrainMethods<T>
> {
  @IsString()
  type!: string;

  @IsString()
  id!: string;

  @IsString()
  method!: K;

  @IsArray()
  args!: any[];
}

export type ExecuteGrainSuccessResponse<
  T extends object,
  K extends keyof GrainMethods<T>
> = {
  status: "success";
  result: GrainMethods<T>[K];
};

export type ExecuteGrainNotFoundResponse = {
  status: "not-found";
};
export type ExecuteGrainErrorResponse = {
  status: "grain-error";
  error: string;
};
export type ExecuteGrainGeneralErrorResponse = {
  status: "error";
  error: string;
};

export type ExecuteGrainMethodResponse<
  T extends object,
  K extends keyof GrainMethods<T>
> =
  | ExecuteGrainSuccessResponse<T, K>
  | ExecuteGrainNotFoundResponse
  | ExecuteGrainErrorResponse
  | ExecuteGrainGeneralErrorResponse;
