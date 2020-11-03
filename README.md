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

    ./export.js > ./data/traffic-history.ndjson

Convert NDJSON to GeoJSON:

    ./ndjson-to-geojson.js < ./data/traffic-history.ndjson > ./data/traffic-history.geojson

Group NDJSON data per segment:

    ./prepare.js < ./data/traffic-history.ndjson > ./data/per-segment.ndjson

Convert NDJSON to GeoJSON:

    ./ndjson-to-geojson.js < ./data/per-segment.ndjson > ./data/per-segment.geojson

## Tools

Timestamps grouped by hour, sorted and unique:

     cat ./data/traffic-history.ndjson | jq -r '.timestamp[:-11]' | sort | uniq

