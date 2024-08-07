import { Grain } from "./Grain";
interface ITestGrain {
  fastMethod(): Promise<number>;
  slowMethod(): Promise<number>;
  errorMethod(num: number): Promise<number>;
}

class TestGrain extends Grain<ITestGrain> implements ITestGrain {
  async fastMethod() {
    return 1;
  }

  async slowMethod() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return 2;
  }

  async errorMethod(num: number) {
    if (num === 1) {
      throw new Error("Error");
    }
    return 3;
  }
}

describe("Grain", () => {
  describe("initilization", () => {
    let grain: TestGrain;
    beforeEach(() => (grain = new TestGrain()));

    it("should throw an error if the grain id is not set", () => {
      expect(() => grain.id).toThrow();
    });

    it("should set the grain id", () => {
      grain.init("test");
      expect(grain.id).toBe("test");
    });

    it("should not changed id if set again", () => {
      grain.init("test");
      grain.init("test2");
      expect(grain.id).toBe("test");
    });
  });

  describe("execution", () => {
    let grain: TestGrain;
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(0);
      grain = new TestGrain();
      grain.init("test");
    });

    it("should execute a method", async () => {
      const result = await grain.execute("fastMethod", []);
      expect(result).toBe(1);
    });

    it("should execute methods in the order execute was called", async () => {
      const fn = jest.fn();
      const ex1 = grain.execute("slowMethod", []).then((v) => {
        fn(v);
        return Promise.resolve();
      });
      const ex2 = grain.execute("fastMethod", []).then((v) => {
        fn(v);
        return Promise.resolve();
      });

      const ex3 = grain.execute("errorMethod", [1]).catch((e) => {
        fn(e.message);
        return Promise.resolve();
      });

      jest.advanceTimersByTime(1000);
      await Promise.all([ex3, ex2, ex1]);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenNthCalledWith(1, 2);
      expect(fn).toHaveBeenNthCalledWith(2, 1);
      expect(fn).toHaveBeenNthCalledWith(3, "Error");
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });
});
