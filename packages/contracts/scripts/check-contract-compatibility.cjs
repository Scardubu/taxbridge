/* Hard-fail compatibility check for compiled Zod v1 contracts. */
const fs = require('node:fs');
const path = require('node:path');
const { toJSONSchema } = require('zod');

const root = path.resolve(__dirname, '..');
const baselinePath = path.join(root, 'compat/v1-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const sync = require(path.join(root, 'dist/sync.js'));
const operations = require(path.join(root, 'dist/operations.js'));
const exported = { ...sync, ...operations };
const names = ['HeartbeatSchema', 'SyncJobSchema', 'PushSyncSchema', 'OperationEnvelopeSchema'];
const failures = [];

function schemaOf(name) {
  const schema = exported[name];
  if (!schema) throw new Error(`Missing exported v1 schema: ${name}`);
  return toJSONSchema(schema);
}
function compare(oldSchema, nextSchema, pathName) {
  if (oldSchema.type && nextSchema.type && oldSchema.type !== nextSchema.type)
    failures.push(`${pathName}: type changed ${oldSchema.type} -> ${nextSchema.type}`);
  if (oldSchema.enum && nextSchema.enum) {
    for (const value of oldSchema.enum)
      if (!nextSchema.enum.includes(value)) failures.push(`${pathName}: enum value removed: ${value}`);
  }
  const oldProps = oldSchema.properties || {};
  const nextProps = nextSchema.properties || {};
  for (const [key, oldProp] of Object.entries(oldProps)) {
    if (!(key in nextProps)) failures.push(`${pathName}.${key}: field removed`);
    else compare(oldProp, nextProps[key], `${pathName}.${key}`);
  }
  const oldRequired = new Set(oldSchema.required || []);
  const nextRequired = new Set(nextSchema.required || []);
  for (const key of oldRequired)
    if (!nextRequired.has(key)) failures.push(`${pathName}.${key}: required field weakened (review required)`);
  for (const key of nextRequired)
    if (!oldRequired.has(key) && key in oldProps)
      failures.push(`${pathName}.${key}: optional field became required`);
  if (oldSchema.items && nextSchema.items) compare(oldSchema.items, nextSchema.items, `${pathName}[]`);
}
for (const name of names) {
  try {
    const current = schemaOf(name);
    const previous = baseline.schemas[name];
    if (!previous) failures.push(`${name}: no protected v1 baseline exists`);
    else compare(previous, current, name);
  } catch (error) { failures.push(`${name}: ${error.message}`); }
}
if (failures.length) {
  console.error('V1 CONTRACT COMPATIBILITY FAILURE');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('V1 contract compatibility check passed.');
