import { Injectable, OnModuleInit } from "@nestjs/common";
import { LocalDirectory } from "../directory";
import { Silo } from "../Silo";
import { IMembershipService } from "./IMembershipService";

@Injectable()
export class InMemoryMembershipService
  implements IMembershipService, OnModuleInit
{
  constructor(private directory: LocalDirectory) {}
  activationCountChanged(): boolean {
    return false;
  }

  siloId = 0;
  siloUrl = "http://localhost";

  get silo(): Silo {
    return {
      id: this.siloId,
      url: this.siloUrl,
      status: "Active",
      activations: this.directory.size,
    };
  }

  onModuleInit() {
    this.siloUrl = `http://localhost:${process.env.PORT || 3000}`;
  }

  setStatus(): Promise<void> {
    return Promise.resolve();
  }
  getSilos(): Silo[] {
    return [];
  }
  getSilo(): Promise<Silo | null> {
    return Promise.resolve(null);
  }
}
