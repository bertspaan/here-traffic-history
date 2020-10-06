#!/usr/bin/env node

const H = require('highland')

const features = H(process.stdin)
  .split()
  .compact()
  .map(JSON.parse)
  .map((line) => ({
    type: 'Feature',
    properties: {
      ...line,
      geometry: undefined
    },
    geometry: line.geometry
  }))
  .compact()
  .map(JSON.stringify)
  .intersperse(',\n')

H([
  H(['{"type":"FeatureCollection","features":[']),
  features,
  H([']}\n'])
]).sequence()
  .pipe(process.stdout)
