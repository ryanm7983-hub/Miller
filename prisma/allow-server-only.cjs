/**
 * The `server-only` package throws when it is loaded outside a React Server
 * Component graph. That guard is exactly what we want in the application, but
 * the seed script legitimately runs the same server modules from plain Node, so
 * it is stubbed out here for that one entry point only.
 */
const Module = require('node:module');

const load = Module._load;
Module._load = function patchedLoad(request, ...rest) {
  if (request === 'server-only') return {};
  return load.call(this, request, ...rest);
};
