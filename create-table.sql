CREATE TABLE here.traffic_history (
	partition_id int8 NULL,
	segment_id int8 NULL,
	"timestamp" timestamp NULL DEFAULT now(),
	jam_factor float8 NULL,
	"data" jsonb NULL,
	"geometry" geometry NULL,
  PRIMARY KEY(partition_id, segment_id, timestamp)
);
