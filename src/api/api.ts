import * as premierepro from "./premierepro";
import * as uxpLib from "./uxp";

export type API = typeof premierepro & typeof uxpLib;

export const api = { ...uxpLib, ...premierepro };
