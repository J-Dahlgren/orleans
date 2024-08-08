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
    this.logger.debug(
      `Received status update for silo ${dto.id}: ${dto.status}`
    );
    this.eventBus.emit(SiloStatusUpdateDto, dto);
    return { message: "ok" };
  }

  @Post(broadcastConstants.grainStatus)
  updateGrainStatus(@Body() dto: GrainStatusUpdateDto) {
    const { grainType, grainId, siloId, status } = dto;
    this.eventBus.emit(GrainStatusUpdateDto, dto);
    this.logger.debug(
      `Received status update for grain ${grainType}/${grainId} on silo ${siloId}: ${status}`
    );
    return { message: "ok" };
  }
}
