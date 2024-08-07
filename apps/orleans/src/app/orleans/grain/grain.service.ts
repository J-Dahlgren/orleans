import { Injectable, Type } from "@nestjs/common";
import { SiloEntity } from "../SiloEntity";
import { MembershipService } from "../silo-membership.service";
import { Grain } from "./Grain";
import {
  ExecuteGrainMethodResponse,
  FindGrainResponse,
  SuccessResponse,
} from "./dto";
import { getGrainIdFromType } from "./utils";

@Injectable()
export class GrainService {
  constructor(private membership: MembershipService) {}
  async executeRemote(
    silo: SiloEntity,
    grainId: string,
    method: string,
    args: any[]
  ): Promise<ExecuteGrainMethodResponse<any, any>> {
    throw new Error("Method not implemented.");
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
          continue;
        }
      } catch (error) {
        console.error(error);
      }
    }
    return null;
  }
  async createGrain<T extends object>(
    type: Type<Grain<T>>,
    id: string,
    silo: SiloEntity
  ): Promise<SuccessResponse> {
    const grainId = getGrainIdFromType(type, id);
    const grain = await fetch(`${silo.url}/orleans/grain/${grainId}`, {
      method: "POST",
    });
    if (!grain.ok) {
      return { success: false };
    }
    const response: SuccessResponse = await grain.json();
    return response;
  }
}
