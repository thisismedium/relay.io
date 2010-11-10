var Application = require("./Application").Application;
var Subscriber  = require("./Subscriber");

var ApplicationSocketLink = require("relay-core/utils").ApplicationSocketLink;

var api = require("relay-core/api");
var net = require("net");

var apps = {
  "test": new Application("test")
};

var server = net.createServer(function (raw_stream) {
  var stream = new ApplicationSocketLink(raw_stream);
  stream.on('data', function (obj) {
    if (obj.getType() == "Hello") {
      if (!apps[obj.getBody()]) {
        stream.write(new api.InvalidApplicationError());
      } else {
        apps[obj.getBody()].assumeStream(stream);
        stream.emit("data", obj);
      }
    } else {
      stream.close();
    }
  });
});

server.listen(8124, 'localhost');

// process.on('uncaughtException', function (err) {
//   console.log('Caught exception: ' + err);
// });
