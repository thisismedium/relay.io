define(['relay/station'], function(Station) {

  var port = process.argv[2],
      station = Station.createServer('*station*').listen(port);

  console.log('%s listening on %s', station, port);
});