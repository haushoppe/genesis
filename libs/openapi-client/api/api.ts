export * from './api.service';
import { ApiService } from './api.service';
export * from './cube.service';
import { CubeService } from './cube.service';
export * from './scales.service';
import { ScalesService } from './scales.service';
export const APIS = [ApiService, CubeService, ScalesService];
