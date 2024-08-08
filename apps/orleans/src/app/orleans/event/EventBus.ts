import { Injectable, Type } from "@nestjs/common";

export type HandleFunction<T> = (event: T) => void;

export interface IEventHandler<T extends object> {
  handle(event: T): void;
}

export type EventHandler<T extends object> =
  | IEventHandler<T>
  | HandleFunction<T>;

@Injectable()
export class EventBus {
  private eventHandlers: Map<Type<object>, EventHandler<any>[]> = new Map();

  register<T extends object>(eventType: Type<T>, handler: EventHandler<T>) {
    let handlers = this.eventHandlers.get(eventType);
    if (!handlers) {
      handlers = [];
      this.eventHandlers.set(eventType, handlers);
    }
    handlers.push(handler);
  }

  emit<T extends object>(type: Type<T>, event: T) {
    const data = Object.assign(new type(), event);
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler instanceof Function ? handler(data) : handler.handle(data);
        } catch (error) {
          console.error(
            `Unhandled error in event handler for event type ${type.name}`,
            error
          );
        }
      }
    }
  }
}
