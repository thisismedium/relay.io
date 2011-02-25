define(["exports","servermedium", "./ApplicationDatabase", "net", "relay-core/api","./api", "relay-core/util"],
       function (exports, serverMedium, ADB, net, CoreApi, Api, U) {

var settings = serverMedium.requireHostSettings();


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

function Hub () {
  var appDB = new ADB.ApplicationDatabase(settings.application_database_path);
  this.handle = function (stream) {
    stream
    .on("GetApplicationData", function (mesg, resp) {
      appDB.getApplicationData(mesg.to, function (err, data) {
        if (err || !data) {
          resp.reply(Api.InvalidApplicationError());
        } else {
          var mesg = Api.ApplicationData(data);
          resp.reply(mesg);
        }
      });
    });
  }
};

function MessageHandler () {
  var hub = new Hub();
  this.handle = function (stream) {
    stream
    .on("RegisterStation",  function (mesg, resp) {
      stream.removeAllListeners("RegisterStation");
      if (mesg.body().key == settings.station_key) {
        hub.handle(stream);
        resp.reply(new Api.Okay());
      } else {
        resp.reply(Api.PermissionDeniedError());
      }
    })
  };
};

exports.app = function () {
  server = Api.createServer("the-hub", (new MessageHandler).handle)

  var host = (args.arguments[2]) ? args.arguments[2] : "0.0.0.0"
  var port = (args.arguments[3]) ? parseInt(args.arguments[3], 10) : 4001

  console.log("RelayHub: starting on  %s:%s", host, port);
  server.listen(port, host);
  if (args.flags.user) {
      console.log("Dropping to user: %s", args.flags.user)
    try {
      process.setuid(args.flags.user);
    } catch (err) {
      throw new Error("Could not set user.");
    }
  }
};

////////////////////////////////////////////////////////////////////////
// Test Data
////////////////////////////////////////////////////////////////////////

var api = CoreApi;
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

});
