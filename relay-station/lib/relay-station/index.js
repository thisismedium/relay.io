var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();

var Application = require("./Application").Application;
var Key         = require("./Key").Key;

var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var Log = require("relay-log/log").Log;

var api = require("relay-core/api");
var net = require("net");

var RelayStation = function () {

  var hubConnection = (new ApplicationSocketLink(net.createConnection(7777, "localhost"))).newChannel();
  var apps = {};

  function getApplication (name, callback) {
    if (!apps[name]) {
      hubConnection.send(api.GetApplicationData(name), function (mesg) {
        if (mesg.type != "Error") {
          var newApp = new Application(mesg.body);
          apps[name] = newApp;
          callback(null, newApp);
        } else {
          callback(mesg, null);
        }
      });
    } else {
      callback(null, apps[name]);
    }
  }

  var identity, logger;

  function logChannels(ev) {
    this.log(ev.type + '-bytes', ev.nbytes, ev.data.to);
    this.log(ev.type + '-count', 1, ev.data.to);
  }

  // This is the object that all of the request are initially handled by
  function MessageHandler (stream) {

    this.Hello = function (request, resp) {
      // When we get the Hello request we must lookup the requested
      // application and begin passing messages onto it.
      getApplication(request.to, function (err, app) {
        if (err) {
          // no application found, report the error
          resp.reply(api.InvalidApplicationError());
        } else {
          // application found, tell the application to assume this
          // stream (.assumeStream should take the control away from the
          // RelayStation so all messages are passed directly to the application)
          stream.bindMessageHandler(new app.MessageHandler());
          stream.dispatch(request);
        }
      });

      // Bind a logger to this stream. Inject a not about the hello
      // request since it wouldn't be tracked otherwise.
      logger
        .bind(stream, request.to)
        .map(logChannels)
        .inject({ appId: request.to, kind: 'hello', count: 1 });
    };

    this.InvalidRequest = function (request) {
      console.log("Got a non Hello request");
      stream.end();
    };
  }

  var server = net.createServer(function (raw_stream) {
    var app_stream = new ApplicationSocketLink(raw_stream);
    app_stream.on("channel", function (stream) {
      stream.bindMessageHandler(new MessageHandler(stream));
    });
  });


  this.listen = function (port, host) {
    console.log("Waiting for a connection to the hub...");

    identity = 'station-' + port + '@' + host;
    logger = new Log().publishUpdates(identity, settings.archive);

    hubConnection.send(api.RegisterStation("test"), function(data) {
      if (data.type == "Error") {
        console.log(" - Could not establish a connection with the hub");
      } else {
        console.log(" + Connection to the hub has been established");
        logger.start();
        return server.listen(port, host);
      }
    });
  }

};

exports.app = function () {
  var port = process.argv[3] ? process.argv[3] : 8124;
  var host = process.argv[2] ? process.argv[2] : "localhost";
  console.log("Starting RelayStation listening on port: " + port + " host: " + host);
  (new RelayStation()).listen(port, host);
}

process.on('uncaughtException', function (err) {
  console.log(err.stack);
  console.log('Caught exception: ' + err);
});

