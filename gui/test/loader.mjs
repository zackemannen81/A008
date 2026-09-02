import { register } from "node:module";

register(new URL("./resolve.mjs", import.meta.url));
