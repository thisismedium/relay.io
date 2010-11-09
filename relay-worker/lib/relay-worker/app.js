var Application = require("./Application").Application;
var Subscriber  = require("./Subscriber");

var SocketReStreamer = require("relay-core/utils").SocketReStreamer
var api = require ("relay-core/api");

var net = require("net");



var apps = {
  "test": new Application("test")
};

var server = net.createServer(function (raw_stream) {
  var stream = new SocketReStreamer(raw_stream);
  stream.on('data', function (data) {
    var json = JSON.parse(data);
    if (json.type == "Hello") {
      if (!apps[json.body]) {
        stream.write((new api.InvalidApplicationError()).dump());
      } else {
        apps[json.body].assumeStream(stream);
        stream.emit("data", data);
      }
    } else {
      stream.close();
    }
  });
});

server.listen(8124, 'localhost');

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});
