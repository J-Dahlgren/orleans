import { TestBed } from "@automock/jest";
import { TestGrain } from "../grains";
import { GrainDirector, RemoteGrainItem } from "./grain-director";

import "reflect-metadata";

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
      director.updateStatus({
        grainId: "1",
        grainType: "TestGrain",
        siloId: 1,
        status: "Activated",
      });
      expect(director.remoteDirectory).toHaveLength(1);
      expect(
        director.remoteDirectory.find(([key]) => key === "TestGrain/1")?.[1]
      ).toEqual({ siloId: 1, status: "Activated" } satisfies RemoteGrainItem);
      director.updateStatus({
        grainId: "1",
        grainType: "TestGrain",
        siloId: 1,
        status: "Deactivating",
      });
      expect(director.remoteDirectory).toHaveLength(0);
    });
  });
});
