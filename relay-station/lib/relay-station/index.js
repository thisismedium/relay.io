var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();

var Application = require("./Application").Application;
var Key         = require("./Key").Key;

var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var Log = require("relay-log/log").Log;

var api = require("relay-core/api");
var net = require("net");

var U = require("relay-core/util");

serverMedium.reportErrors()

var args = U.withProcessArguments()
  .alias("--user","-u")
  .alias("--verbose", "-v")
  .onFlag("-u", function (obj) {
    obj.user = this.nextArgument();
    return obj;
  })
  .onFlag("-v", function (obj) {
    obj.verbose = true;
    return obj
  })
  .parse();


var RelayStation = function () {

  console.log("Connecting to hub %s:%s", settings.hub_host, settings.hub_port)
    
  var hubConnection = (new ApplicationSocketLink(net.createConnection(settings.hub_port, settings.hub_host))).newChannel();
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
    var recv = ev.type == 'out' ? ev.data.to : ev.data.to;
    this.log(ev.type + '-bytes', ev.nbytes * ev.count, recv);
    this.log(ev.type + '-count', ev.count, recv);
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
          
          logger
            .bind(stream, app.getAddress())
            .map(logChannels)
            .inject({ appId: request.to, kind: 'hello', count: 1 });

        }
      });

      // Bind a logger to this stream. Inject a not about the hello
      // request since it wouldn't be tracked otherwise.
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

      hubConnection.send(api.RegisterStation(settings.station_key), function(data) {
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

  var port = args.arguments[3] ? args.arguments[3] : 4011;
  var host = args.arguments[2] ? args.arguments[2] : "localhost";

  console.log("Starting RelayStation listening on port: " + port + " host: " + host);
  (new RelayStation()).listen(port, host);
  if (args.flags.user) {
      console.log("Dropping to user: %s", args.flags.user)
    try {
      process.setuid(args.flags.user);
    } catch (err) {
      throw new Error("Could not set user.");
    }
  }
}


