import { Column, Entity, Generated, PrimaryGeneratedColumn } from "typeorm";

export type SiloStatus =
  | "Created"
  | "Joining"
  | "Active"
  | "Stopping"
  | "Stopped";

export const SiloStatuses: SiloStatus[] = [
  "Created",
  "Joining",
  "Active",
  "Stopping",
  "Stopped",
];
@Entity("membership")
export class SiloEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "enum", enum: SiloStatuses, default: "Created" })
  status!: SiloStatus;

  @Column({ type: "varchar", length: 255 })
  ip!: string;

  @Column({ type: "int", default: 0 })
  port!: number;

  @Generated("uuid")
  @Column()
  token!: string;

  @Column({ type: "int", default: 0 })
  activeGrains!: number;

  get url() {
    return `http://${this.ip}:${this.port}`;
  }
}
