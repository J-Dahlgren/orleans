import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { GrainDirector } from "../grain-director";
import {
  CreateGrainDto,
  ExecuteGrainMethodDto,
  FindGrainResponse,
  SuccessResponse,
} from "./dto";
import { GrainMethods } from "./Grain";

@Controller("orleans/grain")
export class GrainController {
  constructor(private readonly grainDirector: GrainDirector) {}

  @Get(":grainId")
  findGrain(@Param("grainId") grainId: string): FindGrainResponse {
    return {
      success: this.grainDirector.has(grainId),
    };
  }

  @Post()
  async createGrain(@Body() dto: CreateGrainDto): Promise<SuccessResponse> {
    await this.grainDirector.create(dto.type, dto.id);
    return { success: true };
  }

  @Post("execute")
  execute<T extends object, K extends keyof GrainMethods<T>>(
    @Body() dto: ExecuteGrainMethodDto<T, K>
  ) {
    this.grainDirector.executeLocal(
      dto.type,
      dto.id,
      dto.method as string,
      dto.args
    );
  }
}
