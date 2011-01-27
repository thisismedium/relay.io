var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();
var ADB = require("./ApplicationDatabase");
var net = require("net");
var api = require("relay-core/api");
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;

function Hub () {

  var appDB = new ADB.ApplicationDatabase(settings.application_database_path);

  this.MessageHandler = function () {

    self = this;
    this.stream = null;

    this.initialize = function (stream) {
      this.stream = stream;
    }

    this.GetApplicationData = function (mesg, resp) {
      appDB.getApplicationData(mesg.to, function (err, data) {
        if (err || !data) {
          resp.reply(api.InvalidApplicationError());
        } else {
          var mesg = api.ApplicationData(data);
          resp.reply(mesg);
        }
      });
    }
  }
};

function MessageHandler (stream) {

  var hub = new Hub();

  this.RegisterStation = function (mesg, resp) {
    console.log("Registering a station");
    if (mesg.body.key == settings.station_key) {
      stream.bindMessageHandler(new hub.MessageHandler());
      resp.reply(api.Okay());
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
      stream.bindMessageHandler(new MessageHandler(stream));
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

////////////////////////////////////////////////////////////////////////
// Test Data
////////////////////////////////////////////////////////////////////////
var appDB = new ADB.ApplicationDatabase(settings.application_database_path);
var test  = new api.Application();
test.setName("Test App");
test.setAddress("test");
test.updateRole("read_key", "a37d0b8e-2152-4f64-9b0b-1ae7c39d1da7", api.PERM_READ);
test.updateRole("write_key", "1e39e158-3cb8-4bee-bb07-26b71702c471", api.PERM_WRITE | api.PERM_CREATE_CHAN);
test.updateRole("magic_key", "812af3d1-288d-4469-8160-8cbaa4774539", api.PERM_WRITE | api.PERM_READ);
var acl = test.createACL();
acl.addRole("812af3d1-288d-4469-8160-8cbaa4774539", api.PERM_READ);
test.updateChannel("#test", acl, 0);
appDB.putApplicationData(test, function() {});

