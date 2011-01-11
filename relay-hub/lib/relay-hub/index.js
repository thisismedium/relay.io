var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();
var ADB = require("./ApplicationDatabase");
var net = require("net");
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;

function Hub () {
  
  this.RpcHandler = function () {
    this.stream = null;
    this.initialize = function (stream) {
      this.stream = stream;
    }
  }

};


function RelayStationRegisterRPC (db, stream) {

  hub = new Hub(db);

  this.log = function (data) {
    console.log(data);
  };

  this.RegisterStation = function (mesg) {
    if (mesg.getKey() == settings.station_key) {
      api.bindStreamToRpc(stream, new hub.RpcHandler());
    } else {
      stream.send(mesg.replyWith(api.PermissionDeniedError()));
    }
  }

  this.InvalidRequest = function (mesg) {
    stream.send(mesg.replyWith(api.InvalidRequestError()));
  };

};


var server = net.createServer(function (raw_stream) {
  var appDB = new ADB.ApplicationDatabase(settings.application_database_path)
  var appStream = new ApplicationSocketLink(raw_stream);
  appStream.on("channel", function (stream) {
    api.bindStreamToRpc(stream, new RelayStationRPC(appDB, stream));
  });
});
