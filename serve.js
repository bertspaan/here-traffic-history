#!/usr/bin/env node

const path = require('path')
const express = require('express')
const cors = require('cors')
const {Client} = require('pg')

const PORT = process.env.PORT || 8585

const db = new Client(process.env.DATABASE_URL)
db.connect()

const app = express()
app.use(cors())

app.use(express.static(path.join(__dirname, 'public')))

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

app.get('/tiles/:z/:x/:y.mvt', async (req, res) => {
  const z = req.params.z
  const x = req.params.x
  const y = req.params.y

  const query = `
    SELECT ST_AsMVT(ht, 'traffic_history') AS mvt
    FROM (
      SELECT
        segment_id,
        jam_factor,
        ST_AsMVTGeom(geometry, ST_TileEnvelope($1, $2, $3), 4096, 256, true) AS geometry
      FROM traffic_history
      WHERE geometry && ST_TileEnvelope($1, $2, $3)
    ) ht`

  try {
    const tiles = await db.query(query, [z, x, y])
    const tile = tiles.rows[0]
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile')
    if (tile.mvt.length === 0) {
      console.log('No data...')
      res.status(204)
    }
    res.send(tile.mvt)
  } catch (err) {
    res.status(404).send({ error: err.toString() })
    console.error(err)
  }
})
