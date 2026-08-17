// Registers the test loader (see loader.mjs) for `npm test`.
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
