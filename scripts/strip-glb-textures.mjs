#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/strip-glb-textures.mjs INPUT.glb OUTPUT.glb');
}

const source = await readFile(inputPath);
if (source.toString('ascii', 0, 4) !== 'glTF') throw new Error('Input is not a GLB file.');

const jsonLength = source.readUInt32LE(12);
const jsonStart = 20;
const json = JSON.parse(source.toString('utf8', jsonStart, jsonStart + jsonLength).trim());
for (const material of json.materials ?? []) {
  const pbr = material.pbrMetallicRoughness ?? (material.pbrMetallicRoughness = {});
  delete pbr.baseColorTexture;
  delete pbr.metallicRoughnessTexture;
  delete material.normalTexture;
  delete material.occlusionTexture;
  delete material.emissiveTexture;
  pbr.baseColorFactor = [0.78, 0.3, 0.09, 1];
  pbr.metallicFactor = 0.12;
  pbr.roughnessFactor = 0.78;
}
delete json.textures;
delete json.images;

const jsonBytes = Buffer.from(JSON.stringify(json));
const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(paddedJsonLength - jsonBytes.length, 0x20)]);
const binStart = jsonStart + jsonLength + 8;
const binChunk = source.subarray(binStart);
const output = Buffer.alloc(12 + 8 + paddedJson.length + 8 + binChunk.length);
output.write('glTF', 0, 4, 'ascii');
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
let offset = 12;
output.writeUInt32LE(paddedJson.length, offset); offset += 4;
output.writeUInt32LE(0x4e4f534a, offset); offset += 4;
paddedJson.copy(output, offset); offset += paddedJson.length;
output.writeUInt32LE(binChunk.length, offset); offset += 4;
output.writeUInt32LE(0x004e4942, offset); offset += 4;
binChunk.copy(output, offset);
await writeFile(outputPath, output);
console.log('Wrote texture-free GLB: ' + outputPath);
