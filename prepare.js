#!/usr/bin/env node

const H = require('highland')

const msPerHour = 1000 * 60 * 60

function perHour (timestampMin, hoursLength, data) {
  const hours = Array.from({ length: hoursLength }, (_, i) => NaN)

  data.forEach((row) => {
    const index = Math.floor((new Date(row.timestamp) - new Date(timestampMin)) / msPerHour)
    hours[index] = row.jamFactor
  })

  return hours
}

function roundMinutes (timestamp, hoursOffset = 0) {
  const date = new Date(timestamp)
  date.setHours(date.getHours() + hoursOffset)
  date.setMinutes(0, 0, 0)
  return date.toISOString()
}

function hoursFloor (timestamp) {
  return roundMinutes(timestamp)
}

function hoursCeil (timestamp) {
  return roundMinutes(timestamp, 1)
}

H(process.stdin)
  .split('\n')
  .compact()
  .map(JSON.parse)
  .toArray(prepare)

function prepare (rows) {
  const timestamps = rows
    .map((row) => row.timestamp)
    .sort((timestamp1, timestamp2) => new Date(timestamp1) - new Date(timestamp2))

  const timestampMin = hoursFloor(timestamps[0])
  const timestampMax = hoursCeil(timestamps[timestamps.length - 1])

  const msDiff = new Date(timestampMax) - new Date(timestampMin)
  const hoursDiff = Math.ceil(msDiff / msPerHour)

  H(rows)
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
              jamFactor: row.jam_factor
            }))
            .sort((row1, row2) => new Date(row1.timestamp) - new Date(row2.timestamp))
        }))
    })
    .flatten()
    .map((segment) => ({
      ...segment,
      perHourFirstTimestamp: timestampMin,
      perHour: perHour(timestampMin, hoursDiff, segment.data)
    }))
    .map(JSON.stringify)
    .intersperse('\n')
    .pipe(process.stdout)
}
