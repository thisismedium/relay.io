var Api                   = require("relay-core/api");
var Application           = require("./application").Application;
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var Network               = require("relay-core/network");
var Log                   = require("relay-log/log").Log;
var Net                   = require("net");
var ServerMedium          = require("servermedium");
var Util                  = require("relay-core/util");

var settings = ServerMedium.requireSettings();
if (settings.useErrorConsole !== false) 
  ServerMedium.reportErrors();

var args = Util.Arguments.getProcessArguments()
  .alias("--user","-u")
  .alias("--verbose", "-v")
  .onFlag("-u", function (obj) {
    obj.user = this.nextArgument();
    return obj;
  })
  .onFlag("-v", function (obj) {
    obj.verbose = true;
    return obj;
  })
  .parse();

function RelayApplication (dispatcher, appData) {
  // create a new mailbox on the root dispatcher for
  // this application
  var mb = dispatch.newMailbox(app.address);
  // set the perms to be writable
  mb.setDefaultPerms("+w");
  // create a new dispatcher which will work as the 
  // applications dispatcher agent.
  var app = new Dispatcher();
  // tell the root dispatcher to proxy messages for
  // the applications address to the applications 
  // dispatcher agent
  dispatcher.proxyMessages(app.address, app);
  // create a new mailbox on the application dispatcher
  // which will take all request for the app
  var mb2 = app.newMailBox(app.address);
  // set the perms to be writable
  mb2.setDefaultPerms("+w");

  // add a listener for Hello request         
  mb2.on("Hello", function () {
    // This part is a little slippery, we need to setup
    // new client to route to the app dispatcher and also
    // remove it from the root dispatcher

    // create a new client 
    var newClient = newClient(); // TODO
    // remove the clients stream from the root dispatcher          
    dispatcher.removeInputStream(sender.stream);                   
    // and set it up on the application dispatcher                 
    app.collectFromClient(newClient.address, sender.stream);       
    // create a mailbox for the new client                         
    var mb = app.newMailBox(newClient.address);                    
    // set the default perms for the clients private mailbox       
    // to be writable                                              
    mb.setDefaultPerms("+w");                                      
    // tell the mailbox that the client with the newClients        
    // address can read from this mailbox                          
    mb.setClientPerms(newClient.address, "+r");                    
    // add the new clients stream as a subscriber to this mailbox  
    mb.addSubscriber(newClient);                                   
    // send an okay message back to the client                     
    mb.send(Api.Okay().to(newClient.address)); // TODO             
  });

  // add a listener for the Join message
  mb2.on("Join", function () {
    // lookup the channels inbox
    var chan = app.getMailBox(mesg.body.chan);
    // if the channels inbox does not exists create one
    if (!chan) chan = this.createChannelMailBox(mesg.body.chan);
    if (!chan || chan.addSubscriber(sender)) {
      response.reply(Api.PermissionsDenied());
    } else {
      app.dispatch(Api.clientEnter(sender.address).to(mesg.body.chan)); 
    }
  });

  mb.on("Leave", function (mesg) {
    // lookup the channels inbox
    var chan = dispatcher.getMailBox(mesg.body.chan);
    if (chan ) {
      // remove the sender from the mailbox
      chan.removeSubscriber(sender);
      app.dispatch(Api.clientLeft().to(mesg.body.chan));
      response.reply(Api.Okay());
    } else {
      response.reply(Api.InvalidChannel());
    }
  });

          
  logger
    .bind(stream, app.getAddress())
    .map(logChannels)
    .inject({ appId: request.to, kind: 'hello', count: 1 });
  
  this.createChannelMailbox = function (chanName) {
    // TODO can we create the mailbox at all??
    var perms = this.getChannelPermissions(chanName);
    var mb = app.newMailBox(chanName);
    mb.setDefaultPerms(perms);
  };

  this.getChannelPermissions = function () {
    // TODO lookup the proper channel permissions from the app database 
    return 3;
  };
}

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

  this.setupApplication = function (dispatcher, mesg) {
    // This is a bit of a hack here, we basically need to
    // setup applications on the fly.

    // this handler gets called anytime the root dispatcher
    // cannot deliver a message, if we return true it means
    // a new mail box has been setup and the dispatcher will
    // attempt to redeliver the message.  If we return false
    // the dispatcher responds to the sender with a underliverable
    // error.

    // check that the message is a hello message.
    if(mesg.type == "Hello")  {
      // get the application from the hub
      getApplication(request.to, function (err, app) {
        if (err) {
          // if no application then return false;
          next(false);
        } else {
          // Let the RelayApplication set itself up on rootDispatcher
          var app = new RelayApplication(rootDispatcher, appData);
          next(true);
        }
      });
    } else {
      next(false);
    }
  }

});


  var server = Net.createServer(function (raw_stream) {
    var app_stream = new ApplicationSocketLink(raw_stream);
    app_stream.on("channel", function (stream) {
      stream.bindMessageHandler(new MessageHandler(stream));
    });
  });



};

exports.app = function () {

  // Get port and host
  var port = args.arguments[3] ? args.arguments[3] : 4011;
  var host = args.arguments[2] ? args.arguments[2] : "localhost";

  // create a connection to the hub
  var hubConnection = Network.createConnection(settings.hub_port, settings.hub_host);

  // create a root dispatcher
  var dispatcher = new Dispatcher();

  // create a mail box for the hub
  var hubBox = dispatcher.newMailBox("hub");

  // set the hubs mail box permissions to be writable
  hubBox.setClientPerms("relay", "+w");

  // set the hub connection as a subscriber to the hub mailbox
  hubBox.addSubscriber(new Client("hub", hubConnection));

  // create a relay station object
  var relayStation = new RelayStation(dispatcher);

  // tell the root dispatcher to route and undelieverable
  // messages to the relaystation handler (this allows us
  // to setup applications on the fly).
  dispatcher.routeUndeliverablesTo(function () {
    return relayStation.setupApplication.call(this, arguments);
  });

  // create a mailbox for this stations, we will use this mostly
  // just to send messages to the hub
  var stationMB = dispatcher.newMailBox("station");
  // setup a connection to the hub
  stationMB.send(Api.registerStation().to("hub"), function () {
    // create the main listening server
    var server = new Server(host, port) // TODO
    // register the the server in the root dispatcher
    dispatcher.registerServer(server);
  });

  // boring stuff
  console.log("Starting RelayStation listening on port: " + port + " host: " + host);
  if (args.flags.user) {
      console.log("Dropping to user: %s", args.flags.user)
    try {
      process.setuid(args.flags.user);
    } catch (err) {
      throw new Error("Could not set user.");
    }
  }

}


