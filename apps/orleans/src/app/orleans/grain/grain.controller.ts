import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { GrainDirector } from "../GrainDirector";
import {
  CreateGrainDto,
  ExecuteGrainMethodDto,
  FindGrainResponse,
  SuccessResponse,
} from "./dto";
import { GrainMethods } from "./Grain";
import { getGrainId } from "./utils";

@Controller("orleans/grain")
export class GrainController {
  constructor(private readonly grainDirector: GrainDirector) {}

  @Get(":grainType/:grainId")
  findGrain(
    @Param("grainType") grainType: string,
    @Param("grainId") grainId: string
  ): FindGrainResponse {
    return {
      success: this.grainDirector.has(getGrainId(grainType, grainId)),
    };
  }

  @Post()
  async createGrain(@Body() dto: CreateGrainDto): Promise<SuccessResponse> {
    await this.grainDirector.create(dto.type, dto.id);
    return { success: true };
  }

  @Post("execute")
  async execute<T extends object, K extends keyof GrainMethods<T>>(
    @Body() dto: ExecuteGrainMethodDto<T, K>
  ) {
    const result = await this.grainDirector.executeLocal(
      dto.type,
      dto.id,
      dto.method as string,
      dto.args
    );

    return result;
  }
}
