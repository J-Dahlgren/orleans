import { Injectable } from "@nestjs/common";
import { GrainQueue } from "../GrainQueue";

@Injectable()
export class LocalDirectory extends Map<string, GrainQueue<any>> {
  constructor() {
    super();
  }
}
