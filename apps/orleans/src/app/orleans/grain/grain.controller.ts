import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LocalDirectory } from "../directory";
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
@ApiTags("Grain")
export class GrainController {
  constructor(
    private readonly grainDirector: GrainDirector,
    private localDirectory: LocalDirectory
  ) {}

  @Get(":grainType/:grainId")
  findGrain(
    @Param("grainType") grainType: string,
    @Param("grainId") grainId: string
  ): FindGrainResponse {
    return {
      success: this.localDirectory.has(getGrainId(grainType, grainId)),
    };
  }

  @Post()
  async createGrain(@Body() dto: CreateGrainDto): Promise<SuccessResponse> {
    await this.grainDirector.createLocal(dto.type, dto.id);
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

  @Get("activations")
  getActivations() {
    return [...this.localDirectory.keys()];
  }
}
