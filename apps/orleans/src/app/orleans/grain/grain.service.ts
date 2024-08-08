import { Injectable, Logger, Type } from "@nestjs/common";
import { SiloEntity } from "../SiloEntity";
import { MembershipService } from "../silo-membership.service";
import { Grain } from "./Grain";
import {
  CreateGrainDto,
  ExecuteGrainMethodDto,
  ExecuteGrainMethodResponse,
  FindGrainResponse,
  SuccessResponse,
} from "./dto";
import { getGrainMetadata } from "./grain.decorator";

@Injectable()
export class GrainService {
  constructor(private membership: MembershipService) {}
  private logger = new Logger(GrainService.name);
  async executeRemote(
    silo: SiloEntity,
    msg: ExecuteGrainMethodDto<any, any>
  ): Promise<ExecuteGrainMethodResponse<any, any>> {
    const response = await fetch(`${silo.url}/orleans/grain/execute`, {
      method: "POST",
      body: JSON.stringify(msg),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return { status: "error", error: "Failed to execute method" };
    }
    const result: ExecuteGrainMethodResponse<any, any> = await response.json();
    return result;
  }

  async findGrain(type: Type<Grain>, id: string) {
    const silos = await this.membership.getSilos(["Active"], true);
    for (const silo of silos) {
      try {
        const grain = await fetch(
          `${silo.url}/orleans/grain/${type.name}/${id}`
        );
        if (grain.ok) {
          const response: FindGrainResponse = await grain.json();
          if (response.success) {
            return silo;
          }
        } else {
          this.logger.error(await grain.text());
          continue;
        }
      } catch (error) {
        console.error(error);
        continue;
      }
    }
    return null;
  }
  async createGrain<T extends object>(
    type: Type<Grain<T>>,
    id: string,
    silo: SiloEntity
  ): Promise<SuccessResponse> {
    const body: CreateGrainDto = {
      id: id,
      type: getGrainMetadata(type),
    };
    const request = await fetch(`${silo.url}/orleans/grain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!request.ok) {
      this.logger.error(await request.text());
      return { success: false };
    }
    const response: SuccessResponse = await request.json();
    return response;
  }
}
