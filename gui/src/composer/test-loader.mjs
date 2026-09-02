import { register } from "node:module";

register(new URL("./test-resolve.mjs", import.meta.url));
