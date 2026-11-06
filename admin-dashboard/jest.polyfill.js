const v8 = require('v8');
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (v) => v8.deserialize(v8.serialize(v));
}
const streamWeb = require('stream/web');
Object.assign(global, streamWeb);
const util = require('util');
global.TextEncoder = util.TextEncoder;
global.TextDecoder = util.TextDecoder;

const primitives = require('next/dist/compiled/@edge-runtime/primitives');
global.Request = primitives.Request;
global.Response = primitives.Response;
global.Headers = primitives.Headers;
global.fetch = primitives.fetch;
global.FormData = primitives.FormData;
global.Blob = primitives.Blob;
global.File = primitives.File;

if (typeof window !== 'undefined') {
  window.structuredClone = global.structuredClone;
  Object.assign(window, streamWeb);
  window.TextEncoder = util.TextEncoder;
  window.TextDecoder = util.TextDecoder;
  window.Request = primitives.Request;
  window.Response = primitives.Response;
  window.Headers = primitives.Headers;
  window.fetch = primitives.fetch;
  window.FormData = primitives.FormData;
  window.Blob = primitives.Blob;
  window.File = primitives.File;
}
