import { BehaviorSubject, filter, firstValueFrom, take } from "rxjs";
import { AsyncMethod, AsyncMethods, Grain, GrainMethods } from "./grain/Grain";

export interface MessageQueueItem<
  T extends object,
  K extends keyof GrainMethods<T>
> {
  method: K;
  args: any[];
  resolve: (value: ReturnType<AsyncMethod>) => void;
  reject: (reason?: any) => void;
}
export class GrainQueue<T extends object> {
  constructor(public readonly instance: Grain<T>) {}
  private _lastActivity = new Date();
  public get lastActivity() {
    return this._lastActivity;
  }
  private set lastActivity(value: Date) {
    this._lastActivity = value;
  }

  queue: MessageQueueItem<T, keyof GrainMethods<T>>[] = [];

  private isProcessingQueue = new BehaviorSubject(false);

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

  onProcessingDone(): Promise<boolean> {
    if (this.queue.length === 0) {
      return Promise.resolve(true);
    }
    return firstValueFrom(
      this.isProcessingQueue.pipe(
        filter((value) => !value),
        take(1)
      )
    );
  }

  purge() {
    for (const { reject } of this.queue) {
      reject(new Error("Grain is being deactivated forcefully"));
    }
    this.queue = [];
    this.isProcessingQueue.next(false);
  }

  private async processQueue() {
    if (this.isProcessingQueue.value) {
      return;
    }
    this.isProcessingQueue.next(true);
    while (this.queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { method, args, resolve, reject } = this.queue.shift()!;

      const fn = this.instance.methods[method as string].bind(this.instance);
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
    this.isProcessingQueue.next(false);
  }
}
