import { Silo } from "../Silo";
import { SiloStatus } from "../SiloEntity";

export abstract class IMembershipService {
  abstract readonly silo: Silo;

  abstract activationCountChanged(): boolean;

  abstract getSilos(statuses: SiloStatus[], shuffle?: boolean): Silo[];
  abstract getSilo(id: number): Promise<Silo | null>;

  abstract setStatus(status: SiloStatus): Promise<void>;
}
