var Api                   = require("relay-core/api");
var Application           = require("./application").Application;
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var Log                   = require("relay-log/log").Log;
var Net                   = require("net");
var ServerMedium          = require("servermedium");
var Util                  = require("relay-core/util");

var settings = ServerMedium.requireSettings();
if (settings.useErrorConsole !== false) 
  ServerMedium.reportErrors()

var args = Util.Arguments.getProcessArguments()
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

function makeRelayApplication (appData) {
  var dispatcher = new Distpatcher();
  var mb = dispatcher.newMailBox("relay", "+w");
  mb.on("Join", function (mesg) {
    var chan = dispatcher.getMailBox(mesg.body.chan);
    if (!chan) chan = dispatcher.newMailBox(mesg.body.chan);
    chan.setClientPerms(sender.label, "+r");
    chan.addSubscriber(sender);
  });
  mb.on("Leave", function (mesg) {
    var chan = dispatcher.getMailBox(mesg.body.chan);
    });
};


var RelayStation = function (dispatcher, stationBox) {

  var apps = {};

  var identity, logger;

  function logChannels(ev) {
    var recv = ev.type == 'out' ? ev.data.to : ev.data.to;
    this.log(ev.type + '-bytes', ev.nbytes * ev.count, recv);
    this.log(ev.type + '-count', ev.count, recv);
  }

  function getApplication (name, callback) {
    if (!apps[name]) {
      stationBox.send(Api.GetApplication(name).to("hub"), function (mesg) {
        if (mesg.type != "Error") {
          var newApp = makeRelayApplication(mesg.body);
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

  stationBox.on("Hello", function () {
    // When we get the Hello request we must lookup the requested
    // application and begin passing messages onto it.
    getApplication(request.to, function (err, app) {
      if (err) {
        // no application found, report the error
        resp.reply(Api.InvalidApplicationError());
      } else {
        app.collectFromClient(sender.stream);
        var mb = app.newMailBox(newClient.label);
        mb.setDefaultPerms("+w");
        mb.setClientPerms(newClient.label, "+r");
        mb.addSubscriber(newClient);
        mb.send(Api.Okay().to(newClient.label));

        logger
          .bind(stream, app.getAddress())
          .map(logChannels)
          .inject({ appId: request.to, kind: 'hello', count: 1 });
        
      }
    });
  });


  var server = Net.createServer(function (raw_stream) {
    var app_stream = new ApplicationSocketLink(raw_stream);
    app_stream.on("channel", function (stream) {
      stream.bindMessageHandler(new MessageHandler(stream));
    });
  });


  this.listen = function (port, host) {
    console.log("Waiting for a connection to the hub...");
   
    identity = 'station-' + port + '@' + host;
    if (settings.logging !== false) logger = new Log().publishUpdates(identity, settings.archive);
    hubConnection.send(Api.RegisterStation(settings.station_key), function(data) {
      if (data.type == "Error") {
        console.log(" - Could not establish a connection with the hub");
      } else {
        console.log(" + Connection to the hub has been established");
        if (logger) logger.start();
        server.listen(port, host);
      }
    });
  }

};

exports.app = function () {

  var port = args.arguments[3] ? args.arguments[3] : 4011;
  var host = args.arguments[2] ? args.arguments[2] : "localhost";

  var hubConnection = connectToHub() // TODO

  var dispatcher = new Dispatcher();
  var stationBox = dispatcher.newMailBox("relay");

  var hubBox = dispatcher.newMailBox("hub");
  var hubBox.addSubscriber(new Client("hub", hubConnection));

  var server = new Server(host, port) // TODO
  dispatcher.registerServer(server);

  console.log("Starting RelayStation listening on port: " + port + " host: " + host);

  new RelayStation(dispatcher, stationBox);

  if (args.flags.user) {
      console.log("Dropping to user: %s", args.flags.user)
    try {
      process.setuid(args.flags.user);
    } catch (err) {
      throw new Error("Could not set user.");
    }
  }
}


