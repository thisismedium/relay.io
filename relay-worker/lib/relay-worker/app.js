var Application = require("./Application").Application;
var Subscriber  = require("./Subscriber");

var api = require ("relay-core/api");

var net = require("net");

var apps = {};

var server = net.createServer(function (stream) {

  stream.setEncoding('utf8');

  stream.on('data', function (data) {
    var json = JSON.parse(data);
    if (json.type == "Hello") {
      if (!apps[json.body]) {
        apps[json.body] = new Application(json.body)
      }
      apps[json.body].assumeStream(stream);
    } else {
      stream.close();
    }
  });

});
server.listen(8124, 'localhost');
