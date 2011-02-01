CREATE TABLE log (
  start   timestamp without time zone NOT NULL,
  stop    timestamp without time zone NOT NULL,
  appId   text NOT NULL,
  channel text NULL,
  kind    text NOT NULL,
  val     int NOT NULL
);
