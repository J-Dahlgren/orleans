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

export abstract class Grain<T extends object = any> {
  private _lastActivity = new Date();

  status: GrainStatus = "NotActivated";

  public get lastActivity() {
    return this._lastActivity;
  }
  private set lastActivity(value: Date) {
    this._lastActivity = value;
  }

  get methods(): AsyncMethods<T> {
    return this as unknown as AsyncMethods<T>;
  }

  private _id!: string;
  private isInitialized = false;

  init(id: string) {
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

  private queue: MessageQueueItem<T, keyof GrainMethods<T>>[] = [];

  private isProcessingQueue = false;

  execute<K extends keyof AsyncMethods<T>>(method: K, args: any[]) {
    const promise = new Promise<ReturnType<AsyncMethod>>((resolve, reject) => {
      this.queue.push({
        method,
        args,
        resolve,
        reject,
      });
      this.processQueue();
    });
    return promise;
  }

  private async processQueue() {
    if (this.isProcessingQueue) {
      return;
    }
    this.isProcessingQueue = true;
    while (this.queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { method, args, resolve, reject } = this.queue.shift()!;
      const fn = this.methods[method];
      if (typeof fn !== "function") {
        reject(new Error(`Method ${String(method)} not found`));
        continue;
      }
      try {
        this.lastActivity = new Date();
        const result = await fn(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    this.isProcessingQueue = false;
  }

  onActivate() {
    return Promise.resolve();
  }

  onDeactivate() {
    return Promise.resolve();
  }
}
export type GrainMethods<T extends object> = Grain<T>["methods"];
