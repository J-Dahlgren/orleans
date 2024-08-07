import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ORLEANS_DATASOURCE } from "./constants";
import { BroadcastController } from "./messaging/broadcast.controller";
import { SiloEntity } from "./SiloEntity";

@Module({
  controllers: [BroadcastController],
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: "mysql",
      synchronize: true,
      dropSchema: true,
      entities: [SiloEntity],
      host: "localhost",
      name: ORLEANS_DATASOURCE,
      database: "orleans",
      username: "root",
      password: "password",
    }),
  ],
})
export class ClusteringModule {}
