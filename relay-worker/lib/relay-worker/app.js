var Application = require("./Application").Application;
var Key         = require("./Key").Key;

var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;

var api = require("relay-core/api");
var net = require("net");

var apps = {
  "test": new Application("test", 
                          [new Key("read_key",  api.PERM_READ), 
                           new Key("write_key", api.PERM_WRITE)])
};

var server = net.createServer(function (raw_stream) {
  var app_stream = new ApplicationSocketLink(raw_stream);
  app_stream.on("channel", function (stream) {
    stream.on('data', function (obj) {
      if (obj.getType() == "Hello") {
        if (!apps[obj.getBody()]) {
          stream.write(new api.InvalidApplicationError());
        } else {
          apps[obj.getBody()].assumeStream(stream);
          stream.emit("data", obj);
        }
      } else {
        console.log("Got a non Hello request");
        stream.end();
      }
    });
  });
});

server.listen(8124, 'localhost');

// process.on('uncaughtException', function (err) {
//   console.log('Caught exception: ' + err);
// });
