define(['servermedium', 'relay-log/db', 'relay-log/archive'],
function(SM, DB, Archive) {
  var settings = SM.requireHostSettings(),
      db = new DB.LogDB(settings.database);

  Archive.createServer(settings.identity, db)
    .listen(settings.port, settings.host);
});