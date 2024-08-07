import {
  DynamicModule,
  Module,
  OnApplicationBootstrap,
  Type,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SiloEntity } from "./SiloEntity";
import { ORLEANS_DATASOURCE, ORLEANS_GRAIN_TYPES } from "./constants";
import { Grain, GrainController } from "./grain";
import { GrainDirector } from "./grain-director";
import { GrainService } from "./grain/grain.service";
import { LifeCycleService } from "./life-cycle.service";
import { BroadcastController } from "./messaging/broadcast.controller";
import { BroadcastService } from "./messaging/broadcast.service";
import { MembershipService } from "./silo-membership.service";

export interface OrleansModuleOptions {
  grainTypes: Type<Grain>[];
}

@Module({})
export class OrleansModule implements OnApplicationBootstrap {
  constructor(private moduleRef: ModuleRef) {}

  static forRoot(
    opts: Partial<OrleansModuleOptions> = {
      grainTypes: [],
    }
  ): DynamicModule {
    return {
      module: OrleansModule,
      controllers: [BroadcastController, GrainController],
      global: true,
      imports: [
        ScheduleModule.forRoot(),
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
          provide: ORLEANS_GRAIN_TYPES,
          useValue: opts.grainTypes || [],
        },
        LifeCycleService,
        BroadcastService,
        MembershipService,
        GrainDirector,
        GrainService,
      ],
    };
  }
  onApplicationBootstrap() {
    const types = this.moduleRef.get<Type<Grain>[]>(ORLEANS_GRAIN_TYPES);
    this.moduleRef.get(GrainDirector).registerGrains(types);
  }
}
