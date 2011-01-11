var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();

var Application = require("./Application").Application;
var Key         = require("./Key").Key;

var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;

var api = require("relay-core/api");
var net = require("net");

// Test applications
var apps = {
  "test": new Application("test", 
                          [new Key("read_key",  api.PERM_READ), 
                           new Key("write_key", api.PERM_WRITE)])
};

var RelayStation = function () {
  
  // This is the object that all of the request are initially 
  // dispatached to (using the api.runRPC controller). 
  function RelayStationRPC (stream) {

    // The runRPC controller does logging with the .log method
    this.log = function (data) {
      console.log(data.getType());
    };

    this.Hello = function (request) {
      // When we get the Hello request we must lookup the requested
      // application and begin passing messages onto it.
      var appId = request.getBody().getAppId();
      if (!apps[appId]) {
        // no application found, report the error
        console.log("Invalid Application");
        stream.write(request.replyWith(new api.InvalidApplicationError()));
      } else {
        // application found, tell the application to assume this
        // stream (.assumeStream should take the control away from the
        // RelayStation so all messages are passed directly to the application)
        apps[appId].assumeStream(stream);
        stream.emit("data", request);
      }
    };

    // the runRPC framework will all InvalidRequest when a message can not
    // be handled but the rpc object...
    this.InvalidRequest = function (request) {
      console.log("Got a non Hello request");
      stream.end();
    };

  }

  var server = net.createServer(function (raw_stream) {
    var app_stream = new ApplicationSocketLink(raw_stream);
    app_stream.on("channel", function (stream) {
      stream.on("data", api.runRPC(new RelayStationRPC(stream)));
    });
  });
  
  this.listen = function () {
    return server.listen.apply(server, arguments);
  }
  

};

exports.app = function () {
  var port = process.argv[3] ? process.argv[3] : 8124;
  var host = process.argv[2] ? process.argv[2] : "localhost";
  console.log("Starting RelayStation listening on port: " + port + " host: " + host);
  (new RelayStation()).listen(port, host);
}


process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});

