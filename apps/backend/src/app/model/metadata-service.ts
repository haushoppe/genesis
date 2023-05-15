import { Metadata } from '../types/metadata';
import { MintInfo } from '../types/mint-info';


export interface MetadataService {
  generateMetadata(allMints: MintInfo[]): Metadata[];
}
