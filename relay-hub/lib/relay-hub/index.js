define(["exports",
        "servermedium", 
        "./database", 
        "relay-core/api",
        "./api", 
        "relay-core/util",
        "relay-core/utils/uuid"],
       function (exports, 
                 ServerMedium, 
                 DB, 
                 CoreApi, 
                 Api, 
                 Util,
                 Uuid) {
         // Load our settings information from serverMedium
         var settings = ServerMedium.requireHostSettings();

         // parse the command line arguments (if any)
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

         function Hub () {

           var appDB = new DB.ApplicationDatabase(settings.application_database_path);
           createTestApp(appDB);

           this.handle = function (stream) {
             stream
             .on("GetApplication", function (mesg, resp) {
               appDB.getApplicationData(mesg.to, function (data) {
                 resp.reply( data ? Api.ApplicationData(data) :  Api.InvalidApplicationError() ) ; 
               });
             })
             .on("CreateApplication", function (mesg, resp) {
               function aux(callback) {
                 var id = Uuid.getUuid();
                 var app = (new CoreApi.Application())
                   .setName(id.slice(0,8))
                   .setAddress(id);
                 appDB
                   .getApplicationData(id, function (data) {
                     if (data) {
                       aux(callback);
                     } else {
                       return callback(app);
                     }
                   });
               } 
               aux(function(app) {
                 console.log("Putting Application!");
                 appDB.putApplicationData(app, function(err) {
                   console.log("Sending our response");
                   resp.reply(Api.ApplicationData(app));
                 });
               });
             })
             .on("error", function() {
               // TODO, do something with errors...
               return false;
             });
           }

         };

         // All clients (stations) must first pass through the registration handler
         function RegistrationHandler () {
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
             }).on("error", function () {
               // TODO, do something with errors...
               return false;
             })
           };
         };

         exports.app = function () {

           var server = Api.createServer("the-hub", (new RegistrationHandler()).handle);
           var host = (args.arguments[2]) ? args.arguments[2] : "0.0.0.0"
           var port = (args.arguments[3]) ? parseInt(args.arguments[3], 10) : 4001

           console.log("RelayHub: starting on  %s:%s", host, port);

           server.listen(port, host);

           // The --user flag can be used to call setuid after allocating resources
           // this is more of a future proofing feature right now.
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

         createTestApp = function (appDB) {
           var api = CoreApi;
           var test  = (new api.Application())
           .setName("Test App")
           .setAddress("test")
           .updateRole("read_key", "a37d0b8e-2152-4f64-9b0b-1ae7c39d1da7", api.PERM_READ)
           .updateRole("write_key", "1e39e158-3cb8-4bee-bb07-26b71702c471", api.PERM_WRITE | api.PERM_CREATE_CHAN)
           .updateRole("magic_key", "812af3d1-288d-4469-8160-8cbaa4774539", api.PERM_WRITE | api.PERM_READ)
           var acl = test.createACL();
           acl.addRole("812af3d1-288d-4469-8160-8cbaa4774539", api.PERM_READ);
           test.updateChannel("#test", acl, 0);

           appDB.putApplicationData(test, function(err) {
             if (err) throw err;
             appDB.getApplicationData("test", function (app) {
               console.log("Test app has been created");
             })
           })
         }
       });
