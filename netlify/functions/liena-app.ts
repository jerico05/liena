/**
 * Point d’entrée bundlé par esbuild : tout le graphe Express/Yeria est inclus dans la function,
 * sans require() runtime vers sanitize-html/htmlparser2 dans node_modules.
 */
export { createApp } from "../../apps/api/src/app";