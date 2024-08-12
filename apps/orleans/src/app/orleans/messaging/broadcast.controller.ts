import { Body, Controller, Logger, Post } from "@nestjs/common";
import { EventBus } from "../event";
import { broadcastConstants } from "./constants";
import { GrainStatusUpdateDto, SiloStatusUpdateDto } from "./dto";

@Controller("orleans/broadcast")
export class BroadcastController {
  constructor(private eventBus: EventBus) {}
  logger = new Logger(BroadcastController.name);

  @Post(broadcastConstants.siloStatus)
  updateStatus(@Body() dto: SiloStatusUpdateDto) {
    this.eventBus.emit(SiloStatusUpdateDto, dto);
    return { message: "ok" };
  }

  @Post(broadcastConstants.grainStatus)
  updateGrainStatus(@Body() dto: GrainStatusUpdateDto) {
    this.eventBus.emit(GrainStatusUpdateDto, dto);
    return { message: "ok" };
  }
}
