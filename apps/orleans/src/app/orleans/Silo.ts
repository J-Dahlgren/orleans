import type { SiloStatus } from "./SiloEntity";

export interface Silo {
  id: number;
  url: string;
  status: SiloStatus;
  activations: number;
}
