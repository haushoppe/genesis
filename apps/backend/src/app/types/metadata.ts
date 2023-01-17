import { MetatdataAttribute } from "./metatdata-attribute";


export interface Metadata {
  description: string;
  external_url: string;
  image: string;
  name: string;
  attributes: MetatdataAttribute[];
}
