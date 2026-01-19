import type { premierepro as premiereproTypes } from "./types/ppro";

if (typeof require === "undefined") {
  //@ts-ignore
  window.require = (moduleName: string) => {
    return {};
  };
}

export const uxp = require("uxp") as typeof import("uxp");
export const premierepro = require("premierepro") as premiereproTypes;
