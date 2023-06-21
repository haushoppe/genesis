export * from './api.service';
import { ApiService } from './api.service';
export * from './cube.service';
import { CubeService } from './cube.service';
export * from './ordinals.service';
import { OrdinalsService } from './ordinals.service';
export * from './scales.service';
import { ScalesService } from './scales.service';
export const APIS = [ApiService, CubeService, OrdinalsService, ScalesService];
