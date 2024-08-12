import { TestBed } from "@automock/jest";
import { GrainDirector, RemoteGrainItem } from "../GrainDirector";
import { TestGrain } from "./grains";

import "reflect-metadata";
import { getGrainMetadata } from "../grain/grain.decorator";
import { GrainService } from "../grain/grain.service";
import { getGrainIdFromInstance } from "../grain/utils";
import { MembershipService } from "../membership/silo-membership.service";
import { GrainStatusUpdateDto } from "../messaging/dto";
import { SiloEntity } from "../SiloEntity";

describe("GrainDirector", () => {
  describe("initilization", () => {
    let director: GrainDirector;

    beforeEach(() => {
      jest.useFakeTimers();
      const { unit } = TestBed.create(GrainDirector).compile();
      director = unit;
    });

    it("registers grains", () => {
      director.registerGrains([TestGrain]);
    });
  });

  describe("updateStatus", () => {
    let director: GrainDirector;

    beforeEach(() => {
      jest.useFakeTimers();
      const { unit } = TestBed.create(GrainDirector).compile();
      director = unit;
    });

    it("sets status if not 'Deactivating' or 'Deactivated, otherwise removes", () => {
      director.onGrainStatusUpdate({
        grainId: "1",
        grainType: "TestGrain",
        siloId: 1,
        status: "Activated",
      } as GrainStatusUpdateDto);
      expect(director.remoteDirectory.size).toBe(1);
      expect(director.remoteDirectory.get("TestGrain/1")).toEqual({
        siloId: 1,
        status: "Activated",
      } satisfies RemoteGrainItem);
      director.onGrainStatusUpdate({
        grainId: "1",
        grainType: "TestGrain",
        siloId: 1,
        status: "Deactivating",
      });
      expect(director.remoteDirectory.size).toBe(0);
    });
  });

  describe("lookupOrCreate", () => {
    let director: GrainDirector;
    let membershipService: jest.Mocked<MembershipService>;
    let grainService: jest.Mocked<GrainService>;
    beforeEach(() => {
      jest.useFakeTimers();
      const { unit, unitRef } = TestBed.create(GrainDirector).compile();
      director = unit;
      director.registerGrains([TestGrain]);
      membershipService = unitRef.get(MembershipService);
      grainService = unitRef.get(GrainService);
    });

    it("Creates grain locally if no remotes exist", async () => {
      const spy = jest.spyOn(director, "create").mockResolvedValue(undefined);

      membershipService.getSilos.mockResolvedValue([]);

      await director.lookupOrCreate(TestGrain, "1");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("Creates grain locally if activations are less than on remote", async () => {
      const spy = jest.spyOn(director, "create").mockResolvedValue(undefined);
      const silos = [
        {
          id: 1,
          activeGrains: 2,
        },
        {
          id: 2,
          activeGrains: 1,
        },
      ] satisfies Partial<SiloEntity>[] as SiloEntity[];
      membershipService.getSilos.mockResolvedValue(silos);

      await director.lookupOrCreate(TestGrain, "1");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(getGrainMetadata(TestGrain), "1");
    });
    it("Creates grain on remote if activations are less than locally", async () => {
      const spy = jest.spyOn(director, "create").mockResolvedValue(undefined);
      const silos = [
        {
          id: 1,
          activeGrains: 2,
        },
        {
          id: 2,
          activeGrains: -1,
        },
      ] satisfies Partial<SiloEntity>[] as SiloEntity[];
      membershipService.getSilos.mockResolvedValue(silos);
      grainService.createGrain.mockResolvedValueOnce({ success: true });
      await director.lookupOrCreate(TestGrain, "1");
      expect(spy).not.toHaveBeenCalled();
      expect(grainService.createGrain).toHaveBeenCalledTimes(1);

      grainService.createGrain.mockReset();
      grainService.createGrain.mockResolvedValue({ success: false });
      silos[0].activeGrains = -1;
      await director.lookupOrCreate(TestGrain, "1");
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute", () => {
    let director: GrainDirector;
    let membershipService: jest.Mocked<MembershipService>;
    let grainService: jest.Mocked<GrainService>;
    beforeEach(() => {
      jest.useFakeTimers();
      const { unit, unitRef } = TestBed.create(GrainDirector).compile();
      director = unit;
      director.registerGrains([TestGrain]);
      jest.spyOn(director, "lookupOrCreate").mockResolvedValue(undefined);
      membershipService = unitRef.get(MembershipService);
      grainService = unitRef.get(GrainService);
    });

    it("executes locally if in directory", async () => {
      const grain = new TestGrain();
      grain.init("1");
      const spy = jest.spyOn(grain, "method1").mockResolvedValue(1);
      director.localDirectory.set(getGrainIdFromInstance(grain), grain);
      await director.execute(TestGrain, "1", "method1", [2]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(2);
    });
    it("calls execute on remote if not found locally and exists in remote directory", async () => {
      const grain = new TestGrain();
      grain.init("1");
      director.remoteDirectory.set(getGrainIdFromInstance(grain), {
        siloId: 1,
        status: "Activated",
      });
      membershipService.getSilo.mockResolvedValue({ id: 1 } as SiloEntity);
      grainService.executeRemote
        .mockResolvedValueOnce({ status: "success", result: 2 })
        .mockResolvedValueOnce({ status: "error", error: "error" });
      await director.execute(TestGrain, "1", "method1", [2]);
      await expect(
        director.execute(TestGrain, "1", "method1", [3])
      ).rejects.toThrow("error");
      expect(grainService.executeRemote).toHaveBeenCalledTimes(2);
    });
  });
});
