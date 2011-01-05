var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();

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

var RelayStation = function () {
  
  function RelayStationRPC (stream) {

    this.log = function (data) {
      console.log(data.getType());
    };

    this.Hello = function (request) {
      var appId = request.getBody().getAppId();
      if (!apps[appId]) {
        stream.write(new api.InvalidApplicationError());
      } else {
        apps[appId].assumeStream(stream);
        stream.emit("data", request);
      }
    }

    this.InvalidRequest = function (request) {
      console.log("Got a non Hello request");
      stream.end();
    }

  }

  var server = net.createServer(function (raw_stream) {
    var app_stream = new ApplicationSocketLink(raw_stream);
    app_stream.on("channel", function (stream) {
      stream.on('data', api.runRPC(new RelayStationRPC(stream)));
    });
  });
  
  this.listen = function (port, host) {
    server.listen(port, host);
  }

};


exports.app = function () {
  var port = process.argv[3] ? process.argv[3] : 8124;
  var host = process.argv[2] ? process.argv[2] : "localhost";
  console.log("Starting RelayStation listening on port: " + port + " host: " + host);
  (new RelayStation()).listen(port, host);
}

/*
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});
*/
