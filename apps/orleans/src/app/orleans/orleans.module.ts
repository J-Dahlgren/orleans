import {
  DynamicModule,
  Inject,
  Module,
  OnApplicationBootstrap,
  Type,
} from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GrainDirector } from "./GrainDirector";
import { SiloEntity } from "./SiloEntity";
import { ORLEANS_DATASOURCE, ORLEANS_GRAIN_TYPES } from "./constants";
import { LocalDirectory, RemoteDirectory } from "./directory";
import { EventBus } from "./event";
import { Grain, GrainController } from "./grain";
import { GrainService } from "./grain/grain.service";
import { LifeCycleService } from "./life-cycle.service";
import { BroadcastController } from "./messaging/broadcast.controller";
import { BroadcastService } from "./messaging/broadcast.service";
import { ClusterClient } from "./messaging/cluster-client";
import { MembershipService } from "./silo-membership.service";

export interface OrleansModuleOptions {
  grainTypes: Type<Grain>[];
}

@Module({})
export class OrleansModule implements OnApplicationBootstrap {
  constructor(
    @Inject(ORLEANS_GRAIN_TYPES) private types: Type<Grain>[],
    private grainDirector: GrainDirector
  ) {}
  static forRoot(
    opts: Partial<OrleansModuleOptions> = {
      grainTypes: [],
    }
  ): DynamicModule {
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
        EventBus,
        {
          provide: ORLEANS_GRAIN_TYPES,
          useValue: opts.grainTypes || [],
        },

        LifeCycleService,
        LocalDirectory,
        RemoteDirectory,
        BroadcastService,
        MembershipService,
        GrainDirector,
        GrainService,
        ClusterClient,
        ...(opts.grainTypes || []),
      ],
      exports: [ClusterClient],
    };
  }
  onApplicationBootstrap() {
    this.grainDirector.registerGrains(this.types);
  }
}
