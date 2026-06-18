export * from './api.service';
import { ApiService } from './api.service';
export * from './ordinals.service';
import { OrdinalsService } from './ordinals.service';
export const APIS = [ApiService, OrdinalsService];
