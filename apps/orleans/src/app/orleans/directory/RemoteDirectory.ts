import { Injectable } from "@nestjs/common";

import { LRUCache } from "lru-cache";
import { EventBus } from "../event";
import { getGrainId } from "../grain/utils";
import { GrainStatusUpdateDto, SiloStatusUpdateDto } from "../messaging/dto";
import { SiloStatus } from "../SiloEntity";
export interface RemoteGrainItem {
  siloId: number;
  url: string;
}
@Injectable()
export class RemoteDirectory extends LRUCache<string, RemoteGrainItem> {
  constructor(eventBus: EventBus) {
    super({ max: 1000 });
    eventBus.register(SiloStatusUpdateDto, (v) => this.onSiloUpdate(v));
    eventBus.register(GrainStatusUpdateDto, (v) => this.onGrainUpdate(v));
  }
  onGrainUpdate(v: GrainStatusUpdateDto): void {
    const { grainType, grainId, siloId, url } = v;
    if (v.status === "Activated") {
      this.set(v.grainId, {
        siloId,
        url,
      });
    } else {
      this.delete(getGrainId(grainType, grainId));
    }
  }
  onSiloUpdate(event: SiloStatusUpdateDto): void {
    const removeEvents: SiloStatus[] = ["Stopping", "Stopped"];
    if (removeEvents.includes(event.status)) {
      [...this.entries()]
        .filter(([, v]) => v.siloId === event.id)
        .forEach(([k]) => this.delete(k));
    }
  }
}
