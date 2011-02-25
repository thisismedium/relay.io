define(['servermedium', 'relay-log/db', 'relay-log/archive'],
function(SM, DB, Archive) {
    var settings = SM.requireHostSettings();
    var db = new DB.LogDB(settings.database);
    var host = process.argv[2] ? process.argv[2] :  settings.host;
    var port = process.argv[3] ? process.argv[3] : settings.port;
    console.log(" + Listing on %s:%s", host, port);
  Archive.createServer(settings.identity, db)
	.listen(port, host);
});