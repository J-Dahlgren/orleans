import { DynamicModule, Module, OnApplicationBootstrap } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ORLEANS_DATASOURCE, ORLEANS_OPTIONS } from "./constants";
import { LocalDirectory, RemoteDirectory } from "./directory";
import { EventBus } from "./event";
import { GrainController } from "./grain";
import { GrainService } from "./grain/grain.service";
import { GrainDirector } from "./GrainDirector";
import { LifeCycleService } from "./life-cycle.service";
import { IMembershipService } from "./membership/IMembershipService";
import { InMemoryMembershipService } from "./membership/InMemory";
import { MembershipService } from "./membership/silo-membership.service";
import { BroadcastController } from "./messaging/broadcast.controller";
import { BroadcastService } from "./messaging/broadcast.service";
import { ClusterClient } from "./messaging/cluster-client";
import { OrleansModuleOptions } from "./OrleansModuleOptions";
import { PlacementService } from "./PlacementService";
import { SiloEntity } from "./SiloEntity";

const providers = [
  EventBus,
  LifeCycleService,
  LocalDirectory,
  RemoteDirectory,
  BroadcastService,
  PlacementService,
  GrainDirector,
  GrainService,
  ClusterClient,
];

@Module({})
export class OrleansModule implements OnApplicationBootstrap {
  constructor(private moduleRef: ModuleRef) {}

  static inMemory(opts: OrleansModuleOptions) {
    return {
      module: OrleansModule,
      controllers: [BroadcastController, GrainController],
      providers: [
        {
          provide: ORLEANS_OPTIONS,
          useValue: {
            grainTypes: opts.grainTypes,
            grainPlacementStrategy: opts.grainPlacementStrategy,
          } satisfies OrleansModuleOptions,
        },
        ...providers,
        {
          provide: IMembershipService,
          useClass: InMemoryMembershipService,
        },
        ...opts.grainTypes,
      ],
      exports: [ClusterClient],
    };
  }

  static forRoot(opts: OrleansModuleOptions): DynamicModule {
    return {
      module: OrleansModule,
      controllers: [BroadcastController, GrainController],

      imports: [
        TypeOrmModule.forRoot({
          type: "mysql",
          synchronize: true,
          entities: [SiloEntity],
          dropSchema: process.env.DROP_DATABASE === "true",
          host: "localhost",
          name: ORLEANS_DATASOURCE,
          database: "orleans",
          username: "root",
          password: "password",
        }),
      ],
      providers: [
        {
          provide: ORLEANS_OPTIONS,
          useValue: {
            grainTypes: opts.grainTypes,
            grainPlacementStrategy: opts.grainPlacementStrategy,
          } satisfies OrleansModuleOptions,
        },
        ...providers,
        {
          provide: IMembershipService,
          useClass: MembershipService,
        },

        ...opts.grainTypes,
      ],
      exports: [ClusterClient],
    };
  }
  async onApplicationBootstrap() {
    const opts = await this.moduleRef.resolve<OrleansModuleOptions>(
      ORLEANS_OPTIONS
    );
    (await this.moduleRef.resolve(GrainDirector)).registerGrains(
      opts.grainTypes
    );
  }
}
