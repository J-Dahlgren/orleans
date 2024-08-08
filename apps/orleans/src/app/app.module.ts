import { Module } from "@nestjs/common";
import { AppService } from "./app.service";
import { OrleansModule } from "./orleans/orleans.module";
import { TestGrain } from "./TestGrain";

@Module({
  imports: [OrleansModule.forRoot({ grainTypes: [TestGrain] })],
  providers: [AppService],
})
export class AppModule {}
