import ms from "ms";
import { ClusterClient } from "../messaging/cluster-client";

export type AsyncMethod = (...args: any[]) => Promise<any>;

type FilterPropertiesOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

type PickPropertiesByType<T, U> = {
  [K in FilterPropertiesOfType<T, U>]: T[K];
};

export type AsyncMethods<T> = PickPropertiesByType<T, AsyncMethod>;
export type GrainId = number | string;

export type GrainStatus =
  | "NotActivated"
  | "Activating"
  | "Activated"
  | "Deactivating"
  | "Deactivated";

export const grainStatuses: GrainStatus[] = [
  "NotActivated",
  "Activating",
  "Activated",
  "Deactivating",
  "Deactivated",
];

export interface MessageQueueItem<
  T extends object,
  K extends keyof GrainMethods<T>
> {
  method: K;
  args: any[];
  resolve: (value: ReturnType<AsyncMethod>) => void;
  reject: (reason?: any) => void;
}

export class Grain<T extends object = any> {
  status: GrainStatus = "NotActivated";
  grainFactory!: ClusterClient;

  get methods(): AsyncMethods<T> {
    return this as unknown as AsyncMethods<T>;
  }

  private _id!: string;
  private isInitialized = false;

  init(id: string, grainFactory: ClusterClient) {
    this.grainFactory = grainFactory;
    if (!this.isInitialized) {
      this.isInitialized = true;
      this._id = id;
    }
    return this;
  }

  get id() {
    if (!this.isInitialized) {
      throw new Error("Grain not initialized");
    }
    return this._id;
  }

  onActivate() {
    return Promise.resolve();
  }

  onDeactivate() {
    return Promise.resolve();
  }

  getInactivityThreshold() {
    return ms("1m");
  }
}
export type GrainMethods<T extends object> = Grain<T>["methods"];
