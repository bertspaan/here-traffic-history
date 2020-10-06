#!/usr/bin/env node

const H = require('highland')

// TODO: get from data!
const timestampMin = '2020-09-22T15:00:00'
const timestampMax = '2020-09-29T08:00:00'

const msDiff = new Date(timestampMax) - new Date(timestampMin)
const msPerHour = 1000 * 60 * 60
const hoursDiff = msDiff / msPerHour

function sarah (length, data) {
  const emptyArray = Array.from({ length }, (_, i) => NaN)
  data.forEach((row) => {
    const index = Math.floor((new Date(row.timestamp) - new Date(timestampMin)) / msPerHour)
    emptyArray[index] = row.jam_factor
  })

  return emptyArray
}

H(process.stdin)
  .split('\n')
  .compact()
  .map(JSON.parse)
  .group('segment_id')
  .map((grouped) => {
    return H(Object.values(grouped))
      .map((rows) => ({
        partition_id: rows[0].partition_id,
        segment_id: rows[0].segment_id,
        geometry: rows[0].geometry,
        data: rows
          .map((row) => ({
            timestamp: row.timestamp,
            jam_factor: row.jam_factor
          }))
          .sort((row1, row2) => new Date(row1.timestamp) - new Date(row2.timestamp))
      }))
  })
  .flatten()
  .map((segment) => ({
    ...segment,
    values: sarah(hoursDiff, segment.data)
  }))
  .map(JSON.stringify)
  .intersperse('\n')
  .pipe(process.stdout)
