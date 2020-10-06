#!/usr/bin/env node

require('dotenv').config()

const H = require('highland')
const pg = require('pg')
const QueryStream = require('pg-query-stream')

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

async function run () {
  const query = `
    SELECT
      *, ST_AsGeoJSON(geometry)::json AS geometry
    FROM traffic_history`

  const client = await pool.connect()
  const stream = client.query(new QueryStream(query))

  const data = H(stream)
    .map(JSON.stringify)
    .intersperse('\n')

  data
    .pipe(process.stdout)

  data.observe()
    .done(() => client.release())
}

run()
