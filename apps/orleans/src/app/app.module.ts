import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TestGrain } from "./grains";
import { OrleansModule } from "./orleans/orleans.module";

@Module({
  imports: [OrleansModule.forRoot({ grainTypes: [TestGrain] })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
