import { Grain } from "../grain";
import { DefineGrain } from "../grain/grain.decorator";

export interface ITestGrain {
  method1(): Promise<number>;
  method2(): Promise<number>;
}

@DefineGrain({ name: "Test" })
export class TestGrain extends Grain<ITestGrain> implements ITestGrain {
  method1(): Promise<number> {
    return Promise.resolve(1);
  }
  method2(): Promise<number> {
    return Promise.resolve(2);
  }
}
