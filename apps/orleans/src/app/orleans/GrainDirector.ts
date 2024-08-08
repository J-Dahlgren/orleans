import { BadRequestException, Injectable, Logger, Type } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { orderBy } from "lodash";
import ms from "ms";
import { interval } from "rxjs";
import { LocalDirectory, RemoteDirectory } from "./directory";
import { EventBus } from "./event";
import { ExecuteGrainMethodResponse } from "./grain/dto";
import { Grain, GrainMethods, GrainStatus } from "./grain/Grain";
import { getGrainMetadata } from "./grain/grain.decorator";
import { GrainService } from "./grain/grain.service";
import {
  getGrainId,
  getGrainIdFromInstance,
  getGrainIdFromType,
} from "./grain/utils";
import { GrainQueue } from "./GrainQueue";
import { BroadcastService } from "./messaging/broadcast.service";
import { ClusterClient } from "./messaging/cluster-client";
import { broadcastConstants } from "./messaging/constants";
import { GrainStatusUpdateDto } from "./messaging/dto";
import { MembershipService } from "./silo-membership.service";
import { batchArray } from "./utils";

export interface RemoteGrainItem {
  siloId: number;
  status: GrainStatus;
}

@Injectable()
export class GrainDirector {
  private grainMap: Map<string, Type<Grain>> = new Map();
  logger = new Logger(GrainDirector.name);

  constructor(
    eventBus: EventBus,
    private moduleRef: ModuleRef,
    private broadcastService: BroadcastService,
    private membershipService: MembershipService,
    private grainService: GrainService,
    private localDirectory: LocalDirectory,
    private remoteDirectory: RemoteDirectory
  ) {
    interval(ms("5s")).subscribe(() => this.updateGrainCount());
    interval(ms("10s")).subscribe(() => this.checkInactiveGrains());
    eventBus.register(GrainStatusUpdateDto, (v) => this.onGrainStatusUpdate(v));
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
    const localInstance = this.localDirectory.get(getGrainIdFromType(ctor, id));
    if (localInstance) {
      try {
        return {
          status: "success",
          result: await localInstance.execute(method as string, args),
        };
      } catch (error) {
        return {
          status: "grain-error",
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
    const localInstance = this.localDirectory.get(getGrainIdFromType(type, id));

    if (localInstance) {
      return localInstance.execute(method as string, args);
    }

    const grainId = getGrainIdFromType(type, id);
    const silo = await this.membershipService.getSilo(
      this.remoteDirectory.get(grainId)?.siloId || 0
    );

    if (!silo) {
      // Retry until the grain is activated on a silo
      return this.execute(type, id, method, args);
    }

    const response: ExecuteGrainMethodResponse<T, K> =
      await this.grainService.executeRemote(silo, {
        type: getGrainMetadata(type),
        id,
        method,
        args,
      });
    if (response.status === "success") {
      return response.result;
    }
    if (response.status === "not-found") {
      return this.execute(type, id, method, args);
    }
    if (response.status === "grain-error") {
      throw new Error(response.error);
    }

    // Network error, TODO: retry
    throw new Error(response.error);
  }

  onGrainStatusUpdate(data: GrainStatusUpdateDto) {
    const { grainType, grainId, siloId } = data;
    const grainName = getGrainId(grainType, grainId);

    if (
      this.localDirectory.has(grainName) &&
      siloId !== this.membershipService.id
    ) {
      this.logger.warn(
        `Grain ${grainName} has been duplicated on silo ${siloId}, removing local instance`
      );
      this.deactivateGrain(grainName);
    }
  }

  has<T extends object>(
    id: string | { type: Type<Grain<T>>; id: string }
  ): boolean {
    const lookupId =
      typeof id === "string" ? id : getGrainIdFromType(id.type, id.id);

    return this.localDirectory.has(lookupId);
  }

  async lookupOrCreate<T extends object>(type: Type<Grain<T>>, id: string) {
    if (this.localDirectory.get(getGrainIdFromType(type, id))) {
      return;
    }
    if (this.remoteDirectory.has(getGrainIdFromType(type, id))) {
      return;
    }

    const silos = await this.membershipService.getSilos(["Active"], true);
    const silo = await this.grainService.findGrain(type, id);

    if (silo) {
      this.logger.verbose(
        `Found grain ${getGrainIdFromType(type, id)} on silo ${silo.id}`
      );
      this.remoteDirectory.set(getGrainIdFromType(type, id), {
        siloId: silo.id,
        url: silo.url,
      });
      return;
    }

    const ordered = orderBy(silos, (s) => s.activeGrains);
    const currentActivations = this.localDirectory.size;

    for (const silo of ordered) {
      if (silo.activeGrains < currentActivations) {
        const { success } = await this.grainService.createGrain(type, id, silo);
        if (success) {
          this.logger.verbose(
            `Created ${getGrainIdFromType(type, id)} on silo ${silo.id}`
          );
          return;
        } else {
          this.logger.error(
            `Failed to create grain ${getGrainIdFromType(type, id)} on silo ${
              silo.id
            }`
          );
        }
      } else {
        await this.create(getGrainMetadata(type), id);
        return;
      }
    }
    await this.create(getGrainMetadata(type), id);
  }

  async updateGrainCount() {
    if (this.localDirectory.size === this.membershipService.silo.activeGrains) {
      return;
    }
    try {
      this.logger.debug(
        `Updating grain count from ${this.membershipService.silo.activeGrains} to ${this.localDirectory.size}`
      );
      await this.membershipService.updateActiveGrainCount(
        this.localDirectory.size
      );
    } catch (error) {
      this.logger.error(`Failed to update grain count: ${error}`);
    }
  }

  async checkInactiveGrains() {
    const inactiveGrains = [...this.localDirectory.entries()].filter(
      ([, queue]) =>
        queue.lastActivity.valueOf() <
        Date.now() - queue.instance.getInactivityThreshold()
    );
    for (const entries of batchArray(inactiveGrains, 10)) {
      await Promise.all(entries.map(([key]) => this.deactivateGrain(key)));
    }
  }

  async deactivateGrains(purge = false) {
    const local = [...this.localDirectory.entries()];
    for (const entries of batchArray(local, 100)) {
      await Promise.all(
        entries.map(([key]) => this.deactivateGrain(key, purge))
      );
    }
  }

  async deactivateGrain(grainId: string, purgeQueue = false) {
    const queue = this.localDirectory.get(grainId);
    if (!queue) {
      return;
    }

    const grain = queue.instance;
    const silo = this.membershipService.silo;
    try {
      this.localDirectory.delete(grainId);
      grain.status = "Deactivating";
      this.logger.debug(`Deactivating grain ${grainId}...`);
      await this.broadcastService.updateGrainStatus({
        grainId: grain.id,
        grainType: getGrainIdFromInstance(grain),
        status: grain.status,
        url: silo.url,
      });

      if (purgeQueue) {
        queue.purge();
      } else {
        await queue.onProcessingDone();
      }

      await grain.onDeactivate();
      grain.status = "Deactivated";
      this.logger.debug(`Deactivating grain ${grainId}...Done`);
      await this.broadcastService.updateGrainStatus({
        grainId: grain.id,
        grainType: getGrainIdFromInstance(grain),
        status: grain.status,
        url: silo.url,
      });
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
    const existing = this.localDirectory.get(grainName);
    if (existing && existing.instance.status === "Activated") {
      return;
    }
    const instance: Grain = await this.moduleRef.resolve(ctor);
    const factory = await this.moduleRef.resolve(ClusterClient);
    instance.init(id, factory);

    const data: GrainStatusUpdateDto = {
      status: "Activating",
      grainId: id,
      grainType: getGrainMetadata(ctor),
      siloId: this.membershipService.id,
      url: this.membershipService.silo.url,
    };
    this.logger.log(`Activating grain ${grainName}`);
    instance.status = "Activating";
    await this.broadcastService.broadcast(data, broadcastConstants.grainStatus);
    await instance.onActivate();
    instance.status = "Activated";
    data.status = "Activated";
    this.logger.log(`Activated grain ${grainName}`);
    await this.broadcastService.broadcast(data, broadcastConstants.grainStatus);
    const queue = new GrainQueue(instance);
    this.localDirectory.set(grainName, queue);

    return instance;
  }
}
