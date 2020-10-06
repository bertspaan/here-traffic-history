# HERE Traffic History

Saves real-time traffic data from HERE's OLP to a PostgreSQL database.

## Prerequisites

Clone this repository, and install its dependencies by running:

    npm install

The scripts in this repository require the following three environment variables to be set:

- `DATABASE_URL`: [PostgreSQL connection URI](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- `HERE_ACCESS_KEY_ID`: HERE access key ID
- `HERE_ACCESS_KEY_SECRET`: HERE access key secret

You can also create an `.env` file in the root of this repository that contains the environment variables

```
DATABASE_URL=<PostgreSQL connection URI>
HERE_ACCESS_KEY_ID=<HERE access key ID>
HERE_ACCESS_KEY_SECRET=<HERE access key secret>
```

## Exporting data

Export data from database to NDJSON:

    ./export.js > traffic-history.ndjson

Group NDJSON data per segment:

    ./prepare.js < traffic-history.ndjson > per-segment.ndjson

To GeoJSON:

    cat per-segment.ndjson | ../../boven.land/ndjson-to-geojson/ndjson-to-geojson.js > per-segment.geojson

Create vector tiles:

    tippecanoe -l "traffic-history" -zg -o traffic-history.mbtiles --no-tile-size-limit --drop-densest-as-needed per-segment.geojson

    tippecanoe -l "traffic-history" -zg -r1 -pk -pf --no-tile-size-limit --no-feature-limit -B 6 -o traffic-history.mbtiles --extend-zooms-if-still-dropping --no-tile-compression per-segment.geojson

## Tools

     cat traffic-history.ndjson | jq -r '.timestamp[:-11]' | sort | uniq

