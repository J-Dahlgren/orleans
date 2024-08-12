import { Logger } from "@nestjs/common";
import { Grain } from "./orleans/grain";
import { DefineGrain } from "./orleans/grain/grain.decorator";
import {
  getGrainIdFromInstance,
  getGrainIdFromType,
} from "./orleans/grain/utils";

import ms from "ms";
import { GrainPlacementStrategy } from "./orleans/grain/PlacementStategy";

export interface ITestGrain {
  increment(): Promise<number>;
  reset(): Promise<void>;
}

@DefineGrain({ placementStrategy: GrainPlacementStrategy.ActivationCount })
export class TestGrain extends Grain<ITestGrain> implements ITestGrain {
  constructor() {
    super();
  }
  private counter = 0;

  logger = new Logger(`${getGrainIdFromType(TestGrain, "0")}`);

  increment(): Promise<number> {
    this.counter++;
    this.logger.log(`Counter is now ${this.counter}`);
    return Promise.resolve(this.counter);
  }
  reset(): Promise<void> {
    this.counter = 0;
    this.logger.log(`Counter reset to ${this.counter}`);
    return Promise.resolve();
  }

  async onActivate() {
    this.logger = new Logger(getGrainIdFromInstance(this));
  }

  getInactivityThreshold() {
    return ms("10s");
  }
}
