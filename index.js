#!/usr/bin/env node

require('dotenv').config()

const JSZip = require('jszip')
const protobuf = require('protobufjs')

const olpRead = require('@here/olp-sdk-dataservice-read')
const olpAuth = require('@here/olp-sdk-authentication')

const H = require('highland')
const { Client } = require('pg')

const partitionIds = require('./partitions.json')

const accessKeyId = process.env.HERE_ACCESS_KEY_ID
const accessKeySecret = process.env.HERE_ACCESS_KEY_SECRET

// https://developer.here.com/documentation/traffic/dev_guide/topics/tiles.html
const JAM_FACTOR_THRESHOLD = 4

const databaseClient = new Client(process.env.DATABASE_URL)

async function getDecoder (hrn, settings) {
  // Get schema with protobuf files
  const artifactClient = new olpRead.ArtifactClient(settings)
  const detailsRequest = new olpRead.SchemaDetailsRequest()
    .withSchema(olpRead.HRN.fromString(hrn))

  const details = await artifactClient.getSchemaDetails(detailsRequest)

  if (details === undefined || details.variants === undefined) {
    return
  }

  const variant = details.variants.find((item) => item.id === 'ds')
  if (variant === undefined) {
    return
  }

  const request = new olpRead.SchemaRequest().withVariant(variant)
  const archive = await artifactClient.getSchema(request)

  // Load schema as a ZIP archive
  const zip = new JSZip()
  await zip.loadAsync(archive)

  // Read all .proto file and parse them by Protobuf
  const protobufRoot = new protobuf.Root()
  Object.keys(zip.files).forEach(async (fileName) => {
    if (!fileName.endsWith('.proto')) {
      return
    }

    const file = await zip.file(fileName).async('text')
    protobuf.parse(file, protobufRoot, {
      keepCase: true
    })
  })

  // Extract the manifest data.
  const manifestFile = await zip.file('META-INF/layer.manifest.json').async('text')
  const manifest = JSON.parse(manifestFile)

  return protobufRoot.lookupType(manifest.main.message)
}

function decode (data, decoder) {
  const uint8Array = new Uint8Array(data)
  const decodedMessage = decoder.decode(uint8Array)

  return decodedMessage.$type.toObject(decodedMessage, {
    defaults: true,
    longs: String,
    enums: String,
    bytes: String,
    json: true
  })
}

async function getLayerConfig (layer, settings) {
  const catalogClient = new olpRead.CatalogClient(olpRead.HRN.fromString(layer.catalog), settings)
  const config = await catalogClient.getCatalog(new olpRead.CatalogRequest())
  return config.layers.find((item) => item.id === layer.id)
}

async function getDataAndDecode (client, request, decoder) {
  const response = await client.getData(request)
  const data = await response.arrayBuffer()

  const decodedData = decode(data, decoder)
  return decodedData
}

async function getData (client, request) {
  const response = await client.getData(request)
  const data = await response.arrayBuffer()
  // https://nodejs.org/api/util.html#util_class_util_textdecoder
  const decoder = new TextDecoder('utf-8')
  return decoder.decode(data)
}

function toSegments (str) {
  return str.replace(/\[|\]/g, '').split(', ').map((segmentStr) => {
    const entries = segmentStr.split(' ')

    const segmentId = entries[0]
    const data = Object.fromEntries(entries.slice(1)
      .map((entry) => entry.split(':').map((d, i) => i === 0 ? d : parseFloat(d))))

    return {
      segmentId: parseInt(segmentId.slice(0, segmentId.length - 2)),
      direction: segmentId[segmentId.length - 2],
      ...data
    }
  })
}

function getLayerClient (layer, settings) {
  if (layer.type === 'volatile') {
    return new olpRead.VolatileLayerClient({
      catalogHrn: layer.catalog,
      layerId: layer.id,
      settings
    })
  } else if (layer.type === 'versioned') {
    return new olpRead.VersionedLayerClient({
      catalogHrn: layer.catalog,
      layerId: layer.id,
      settings
    })
  } else {
    throw new Error(`Layer type not supported: ${layer.type}`)
  }
}

async function insert (client, row) {
  const query = `
    INSERT INTO here.traffic_history (partition_id, segment_id, jam_factor, "data", "geometry")
    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))`

  await client.query(query, [
    row.partitionId,
    row.segmentId,
    row.jamFactor,
    row.data,
    row.geometry
  ])
}

async function downloadData () {
  const userAuth = new olpAuth.UserAuth({
    env: 'here',
    credentials: {
      accessKeyId,
      accessKeySecret
    },
    tokenRequester: olpAuth.requestToken
  })

  const settings = new olpRead.OlpClientSettings({
    environment: 'here',
    getToken: () => userAuth.getToken()
  })

  const topologyLayer = ({
    id: 'topology-geometry',
    catalog: 'hrn:here:data::olp-here:rib-2',
    type: 'versioned'
  })

  const trafficLayer = ({
    id: 'traffic',
    catalog: 'hrn:here:data::olp-amsterdam:nld-traffic-decoded',
    type: 'volatile'
  })

  const topologyLayerClient = getLayerClient(topologyLayer, settings)
  const trafficClient = getLayerClient(trafficLayer, settings)

  const topologyLayerConfig = await getLayerConfig(topologyLayer, settings)
  const topologyDecoder = await getDecoder(topologyLayerConfig.schema.hrn, settings)

  const hereLayersPerPartition = await Promise.all(partitionIds.map(async (partitionId) => {
    const request = new olpRead.DataRequest()
      .withPartitionId(partitionId)

    const decodedTopologyData = await getDataAndDecode(topologyLayerClient, request, topologyDecoder)
    const trafficData = await getData(trafficClient, request)

    return {
      partitionId,
      topology: decodedTopologyData,
      traffic: toSegments(trafficData)
    }
  }))

  const trafficDataPerSegment = {}

  hereLayersPerPartition.forEach((partition) => partition.traffic.forEach((segment) => {
    const partitionId = partition.partitionId

    if (!trafficDataPerSegment[partitionId]) {
      trafficDataPerSegment[partitionId] = {}
    }

    const segmentId = segment.segmentId
    trafficDataPerSegment[partitionId][segmentId] = segment
  }))

  const rows = hereLayersPerPartition
    .map((partition) => partition.topology.segment
      .map((segment) => {
        const partitionId = partition.partitionId
        const segmentId = segment.identifier.split(':')[3]
        if (trafficDataPerSegment[partitionId][segmentId] && segment.geometry.point.length === 2) {
          const trafficData = trafficDataPerSegment[partitionId][segmentId]

          return {
            partitionId,
            segmentId,
            jamFactor: trafficData.JF,
            data: trafficData,
            geometry: {
              type: 'LineString',
              coordinates: segment.geometry.point.map((point) => [point.longitude, point.latitude])
            }
          }
        }
      })
    )
    .flat()
    .filter((row) => row && row.jamFactor > JAM_FACTOR_THRESHOLD)

  await databaseClient.connect()

  H(rows)
    .flatMap((row) => H(insert(databaseClient, row)))
    .done(async () => {
      await databaseClient.end()
    })
}

downloadData()
