define(['servermedium', 'relay-log/db', 'relay-log/archive'],
function(SM, DB, Archive) {
  var settings = SM.requireHostSettings();

  Archive.createServer(new DB.LogDB(settings.database))
    .listen(settings.port, settings.host);
});