import { BadRequestException, Injectable, Logger, Type } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { orderBy } from "lodash";
import { LRUCache } from "lru-cache";
import ms from "ms";
import { timer } from "rxjs";
import { ExecuteGrainMethodResponse } from "./grain/dto";
import { Grain, GrainMethods, GrainStatus } from "./grain/Grain";
import { getGrainMetadata } from "./grain/grain.decorator";
import { GrainService } from "./grain/grain.service";
import { getGrainId, getGrainIdFromType } from "./grain/utils";
import { BroadcastService } from "./messaging/broadcast.service";
import { broadcastConstants } from "./messaging/constants";
import { GrainStatusUpdateDto } from "./messaging/dto";
import { MembershipService } from "./silo-membership.service";

export interface RemoteGrainItem {
  siloId: number;
  status: GrainStatus;
}

@Injectable()
export class GrainDirector {
  private grainMap: Map<string, Type<Grain>> = new Map();

  logger = new Logger(GrainDirector.name);
  private _localDirectory: Map<string, Grain<any>> = new Map();
  private _remoteDirectory: Map<string, RemoteGrainItem> = new LRUCache({
    max: 100,
  });

  get localDirectory() {
    return [...this._localDirectory.entries()];
  }

  get remoteDirectory() {
    return [...this._remoteDirectory.entries()];
  }

  constructor(
    private moduleRef: ModuleRef,
    private broadcastService: BroadcastService,
    private membershipService: MembershipService,
    private grainService: GrainService
  ) {
    timer(ms("10s"), ms("60s")).subscribe(() => this.updateGrainCount());
  }

  registerGrains(grains: Type<Grain>[]) {
    grains.forEach((grain) => {
      const grainName = getGrainMetadata(grain);
      this.grainMap.set(grainName, grain);
    });
  }

  async executeLocal<T extends object, K extends keyof GrainMethods<T>>(
    type: string,
    id: string,
    method: string,
    args: any[]
  ): Promise<ExecuteGrainMethodResponse<T, K>> {
    const ctor = this.grainMap.get(type);
    if (!ctor) {
      throw new BadRequestException(`Grain type ${type} not found`);
    }
    const localInstance = this._localDirectory.get(
      getGrainIdFromType(ctor, id)
    );
    if (localInstance) {
      try {
        return {
          status: "success",
          result: await localInstance.execute(method as string, args),
        };
      } catch (error) {
        return {
          status: "error",
          error: error.message,
        };
      }
    }
    return {
      status: "not-found",
    };
  }

  async execute<T extends object, K extends keyof GrainMethods<T>>(
    type: Type<Grain<T>>,
    id: string,
    method: K,
    args: any[]
  ): Promise<GrainMethods<T>[K]> {
    await this.lookupOrCreate(type, id);
    const localInstance = this._localDirectory.get(
      getGrainIdFromType(type, id)
    );
    if (localInstance) {
      return localInstance.execute(method as string, args);
    }

    const grainId = getGrainIdFromType(type, id);
    const silo = await this.membershipService.getSilo(
      this._remoteDirectory.get(grainId)?.siloId
    );

    if (!silo) {
      // Retry until the grain is activated on a silo
      return this.execute(type, id, method, args);
    }

    const response = await this.grainService.executeRemote(
      silo,
      grainId,
      method as string,
      args
    );
    if (response.status === "success") {
      return response.result;
    }
    if (response.status === "not-found") {
      return this.execute(type, id, method, args);
    }

    throw new Error(response.error);
  }

  removeForSilo(siloId: number) {
    [...this._remoteDirectory.entries()]
      .filter(([, item]) => item.siloId === siloId)
      .map(([key]) => key)
      .forEach((key) => this._remoteDirectory.delete(key));
  }

  updateStatus(data: GrainStatusUpdateDto) {
    const { grainType, grainId, siloId, status } = data;
    const removeIfStatus = ["Deactivating", "Deactivated"];
    const grainName = getGrainId(grainType, grainId);
    if (removeIfStatus.includes(status)) {
      this._remoteDirectory.delete(grainName);
    } else {
      this._remoteDirectory.set(grainName, { siloId, status });
    }
  }

  has<T extends object>(
    id: string | { type: Type<Grain<T>>; id: string }
  ): boolean {
    const lookupId =
      typeof id === "string" ? id : getGrainIdFromType(id.type, id.id);

    return this._localDirectory.has(lookupId);
  }

  async lookupOrCreate<T extends object>(type: Type<Grain<T>>, id: string) {
    if (this._localDirectory.get(getGrainIdFromType(type, id))) {
      return;
    }
    if (this._remoteDirectory.has(getGrainIdFromType(type, id))) {
      return;
    }
    const silos = await this.membershipService.getSilos(["Active"]);

    const ordered = orderBy(silos, (s) => s.activeGrains);
    const currentActivations = this._localDirectory.size;
    for (const silo of ordered) {
      if (silo.activeGrains > currentActivations) {
        await this.create(getGrainMetadata(type), id);
        return;
      }
      const { success } = await this.grainService.createGrain(type, id, silo);
      if (success) {
        return;
      }
    }
    await this.create(getGrainMetadata(type), id);
  }

  async updateGrainCount() {
    try {
      await this.membershipService.updateActiveGrainCount(
        this._localDirectory.size
      );
    } catch (error) {
      this.logger.error(`Failed to update grain count: ${error}`);
    }
  }

  async deactivateGrains() {
    const entries = [...this._localDirectory.entries()];
    for (const [key] of entries) {
      await this.deactivateGrain(key);
    }
  }

  async deactivateGrain(grainId: string) {
    const grain = this._localDirectory.get(grainId);
    if (!grain) {
      return;
    }
    try {
      this._localDirectory.delete(grainId);
      grain.status = "Deactivating";
      grain.onDeactivate();
    } catch (error) {
      this.logger.error(`Failed to deactivate grain ${grainId}: ${error}`);
    }

    grain.status = "Deactivated";
  }

  async create(type: string, id: string) {
    const ctor = this.grainMap.get(type);
    if (!ctor) {
      throw new Error(`Grain type ${type} not found`);
    }
    const grainName = getGrainIdFromType(ctor, id);
    const existing = this._localDirectory.get(grainName);
    if (existing && existing.status === "Activated") {
      return;
    }
    const instance: Grain = await this.moduleRef.resolve(type);
    instance.init(id);
    const data: GrainStatusUpdateDto = {
      status: "Activating",
      grainId: id,
      grainType: getGrainMetadata(ctor),
      siloId: this.membershipService.id,
    };
    instance.status = "Activating";
    await this.broadcastService.broadcast(data, broadcastConstants.grainStatus);
    await instance.onActivate();
    instance.status = "Activated";
    data.status = "Activated";
    await this.broadcastService.broadcast(data, broadcastConstants.grainStatus);
    this._localDirectory.set(grainName, instance);
    return instance.methods;
  }
}
