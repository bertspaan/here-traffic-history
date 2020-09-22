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
  const z = req.params.z // 16
  const x = req.params.x // 33748
  const y = req.params.y // 21601

  res.send('Hoi!')

  // const query = `
  //   SELECT ST_AsMVT(mvtgeom) AS mvt
  //   FROM (
  //     SELECT ST_AsMVTGeom(geometry, ST_TileEnvelope($1, $2, $3), 4096, 256, true) AS geom
  //     FROM bovenland.cbs
  //     WHERE geometry && ST_TileEnvelope($1, $2, $3)
  //   ) mvtgeom`

  // const query2 = `
  //   SELECT ST_AsMVT(layer, '${LAYER_NAME}') AS mvt FROM (
  //     SELECT
  //       *,
  //       ST_AsMVTGeom(
  //         geometry,
  //         ST_TileEnvelope($1, $2, $3),
  //         4096,
  //         256,
  //         true
  //       ) AS geometry
  //     FROM (
  //       SELECT
  //         osm_id,
  //         -- data,
  //         ST_Translate(ST_Translate(
  //           -ST_X(geometry) + ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(5.387201, 52.155172), 4326), 3857)),
  //           -ST_Y(geometry) + ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(5.387201, 52.155172), 4326), 3857))
  //         ), col * 10, row * 10) AS geometry

  //         --ST_Transform(geometry, 4326) AS geometry

  //       FROM (
  //         SELECT
  //           *,
  //           (index - 1) % 10 AS col,
  //           (index - 1) / 10 AS row
  //         FROM (
  //           SELECT
  //             osm_id,
  //             data,
  //             ST_Transform(geometry, 3857) AS geometry,
  //             ROW_NUMBER() OVER (ORDER BY (data->>'nearbyShops')::int DESC) AS index
  //           FROM bovenland.shops
  //           ORDER BY (data->>'nearbyShops')::int DESC
  //           LIMIT 100
  //         ) items
  //       ) grid
  //     ) translated
  //     -- WHERE
  //     --  geometry && ST_TileEnvelope($1, $2, $3)
  //   ) layer`

  // try {
  //   //const tiles = await db.query(query, [COLS, ROWS, RADIUS])
  //   const tiles = await db.query(query2, [z, x, y])
  //   const tile = tiles.rows[0]
  //   res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile')
  //   if (tile.mvt.length === 0) {
  //     console.log('No data...')
  //     res.status(204)
  //   }
  //   res.send(tile.mvt)
  // } catch (err) {
  //   res.status(404).send({ error: err.toString() })
  //   console.error(err)
  // }
})
