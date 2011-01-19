var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();
var ADB = require("./ApplicationDatabase");
var net = require("net");
var api = require("relay-core/api");
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;

function Hub () {

  var appDB = new ADB.ApplicationDatabase(settings.application_database_path);

  this.RpcHandler = function () {
    self = this;
    this.stream = null;
    this.initialize = function (stream) {
      this.stream = stream;
    }
    this.GetApplicationData = function (mesg, resp) {
      appDB.getApplicationData(mesg.getAppId(), function (err, data) {
        if (err || !data) {
          resp.reply(api.InvalidApplicationError());
        } else {
          resp.reply(data);
        }
      });
    }
  }
};

function RelayStationRegisterRPC (stream) {

  hub = new Hub();

  this.log = function (data) {
    console.log(data);
  };

  this.RegisterStation = function (mesg, resp) {
    if (mesg.getKey() == settings.station_key) {
      stream.bindRpcHandler(new hub.RpcHandler());
      resp.reply(new api.Success());
    } else {
      resp.reply(api.PermissionDeniedError());
    }
  }

  this.InvalidRequest = function (mesg, resp) {
    resp.reply(api.InvalidRequestError());
  };

};

exports.app = function () {
  var server = net.createServer(function (raw_stream) {
    var appStream = new ApplicationSocketLink(raw_stream);
    appStream.on("channel", function (stream) {
      stream.bindRpcHandler(new RelayStationRegisterRPC(stream));
    });
  });
  console.log("RelayHub: starting on port 7777");
  server.listen(7777, "0.0.0.0");
};

process.on('uncaughtException', function (err) {
  console.log(err.stack);
  console.log('Caught exception: ');
  console.log(err);
});

