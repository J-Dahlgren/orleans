import { Body, Controller, Logger, Post } from "@nestjs/common";
import { GrainDirector } from "../grain-director";
import { SiloStatus } from "../SiloEntity";
import { broadcastConstants } from "./constants";
import { GrainStatusUpdateDto, StatusUpdateDto } from "./dto";

@Controller("orleans/broadcast")
export class BroadcastController {
  constructor(private directory: GrainDirector) {}
  logger = new Logger(BroadcastController.name);

  @Post(broadcastConstants.siloStatus)
  updateStatus(@Body() dto: StatusUpdateDto) {
    this.logger.debug(
      `Received status update for silo ${dto.siloId}: ${dto.status}`
    );
    const deleteOnStatus: SiloStatus[] = ["Stopping", "Stopped"];
    if (deleteOnStatus.includes(dto.status)) {
      this.directory.removeForSilo(dto.siloId);
    }
    return { message: "ok" };
  }

  @Post(broadcastConstants.grainStatus)
  updateGrainStatus(@Body() dto: GrainStatusUpdateDto) {
    const { grainType, grainId, siloId, status } = dto;
    this.directory.updateStatus(dto);
    this.logger.debug(
      `Received status update for grain ${grainType}/${grainId} on silo ${siloId}: ${status}`
    );
    return { message: "ok" };
  }
}
