var api                   = require("relay-core/api");
var groupChannelsBySocket = require("relay-core/multiplex").groupChannelsBySocket;
var Key                   = require("./Key").Key;

// Application ////////////////////////////////////////////////////////////

function Application (applicationData) {

  // Route (a.k.a Channel) ///////////////////////

  function Route (name) {

    var subscribers = [];

    this.getName = function getName () {
      return name;
    }

    this.addSubscriber = function addSubscriber (client) {
      for (var i = 0; i < subscribers.length; i++) {
        if (subscribers[i].getClientId() == client.getClientId()) {
          return false;
        }
      }
      subscribers.push(client);
      return true;
    };

    this.listSubscribers = function listSubscribers () {
      return subscribers.map(function(subscriber) {
        return subscriber.getClientId();
      });
    };

    this.removeSubscriber = function removeSubscriber (client) {
      var out = [];
      var res = subscribers;
      console.log(res.length);
      for (var i = 0; i < res.length; i++) {
        if (res[i].getClientId() != client.getClientId()) out.push(res[i]);
      }
      subscribers = out;
      console.log(out.length);
    };

    this.send = function send (mesg) {
      var streams = subscribers.map(function (s) { return s.getStream() });
      groupChannelsBySocket(streams).forEach(function(sub) {
        sub[0].multiWrite(sub, mesg);
      });
    }

  };

  // Client ///////////////////////////////////
  
  /* 
     a Client is a user of the application, when a client initializes a
     session it is given a client-id...
  */
  
  function Client (client_id, stream, perms) {

    this.canWrite = function canWrite () {
      return api.PERM_WRITE & perms
    };

    this.canRead = function canRead () {
      return api.PERM_READ & perms
    };

    this.resetPerms = function resetPerms () {
      perms = 0;
      return this;
    };

    this.setPerms = function setPerms (p) {
      perms = p | perms;
      return this;
    };

    this.getClientId = function getClientId() {
      return client_id;
    };

    this.getStream = function getString () {
      return stream;
    };

    this.getSocket = function getSocket () {
      return stream.getSocket();
    };

    this.send = this.write = function write(data) {
      return stream.send(data);
    };

  }

  ////////////////////////////////////////////////////////////////////////

  var self = this;

  var appId = applicationData.getAddress();

  this.getAppId = function () { 
    return applicationData.getAddress();
  };

  ////////////////////////////////////////////////////////////////////////

  // The routes of this application can be either @users or #channels
  // subchannels look like #channels/#subchannel
  // this is a flat list of key/value mappings
  // all application have a #global channel.  The global channel acts
  // as a control channel for the entire application.

  var routes = { "#global": new Route("#global") };
  var current_client_id = 0;

  function newClientId () {
    return ("@client-" + appId + "-" + (++current_client_id));
  }

  ////////////////////////////////////////////////////////////////////////

  function getKeyByHash (hash) {
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].getHash() === hash) {
        return keys[i];
      }
    }
    return undefined;
  };

  ////////////////////////////////////////////////////////////////////////

  this.messageHandler = function messageHandler () {

    var client = null;

    this.initialize = function (app_stream) {
      client = new Client(newClientId(), app_stream, 0);
      app_stream.on("close", function () {
        app_stream.destroy();
      });
      
      app_stream.on("end", function () {
        app_stream.destroy();
      });
    };

    // Client said "Hello", they are brand new to the world...
    this.Hello = function (request, resp) {

      // If the request includes keys setup new permissions for the user.
      if (request.body.keys) {
        request.body.keys.forEach(function(key){
          var real_key = applicationData.getRoleByKey(key);
          console.log("SETTING UP KEY: " + real_key.name);
          if (real_key) {
            client.setPerms(real_key.mask);
          }
        });
      }

      // Join the users private channel.
      joinRoute(client.getClientId(), client);

      // Join the global control channel.
      joinRoute("#global", client);

      // Inform the client about their client_id.
      resp.reply(api.Welcome(client.getClientId()));

      // Inform the global channel of the clients activation.
      sendMessageToRoute("#global", new api.ClientEnter(client.getClientId(), "#global"));
        
    }

    // Client said "Join", the client wants to join a channel to listen for updates

    this.Join = function (request, resp) {
      var addr = request.to;
      if (client.canRead() && addr.match("^#[a-zA-Z1-9]*$")) {
        if (!joinRoute(addr, client)) {
          resp.reply(api.error(500, "Internal Error"));
        } else {
          // If the client is able to join the channel (aka route) then inform everyone on that channel that they have entered.
          sendMessageToRoute(addr, new api.ClientEnter(client.getClientId(), addr));            
          // Inform the client of a successful "Join".
          resp.reply(api.Okay());
        }
      } else {
        resp.reply(new api.PermissionDeniedError());
      }
    }

    this.GetStatus = function (request, resp) {
      var route = request.to;
      if (routes[route]) {
        resp.reply(api.Status(route, routes[route].listSubscribers()));
      } else {
        resp.reply(api.PermissionDeniedError());
      }
    }

    // Client said "Leave" and wanted to leave a room.

    this.Leave = function (request, resp) {
      var addr = request.to;
      removeSubscriber(addr, client);
      sendMessageToRoute(addr, api.ClientExit(client.getClientId(), addr));
      resp.reply(api.Okay());
    }

    // The client as sent us a "Message", we need to route it to the right users.
    this.Message = function (request, resp) {

      if (client.canWrite()) {
        // The client could be pulling a fast one so we simply discard the "from" field from the messages and set it to whatever
        // user we tagged in incoming stream with.
        request.from = client.getClientId();
          
        process.nextTick (function () {
          // Send the message to the proper channels.
          sendMessageToRoute(request.to, request);
          // Inform the client that their message has been delivered.
          resp.reply(api.Okay());
          
        });
      } else {
        client.send(api.PermissionDeniedError());
      }
    }

    this.InvalidRequest = function (request, resp) {
      resp.reply(new api.InvalidRequestError());
    };

  };


  ////////////////////////////////////////////////////////////////////////

  function joinRoute (id, client) {
    addSubscriber (id, client);
    // Set listener so that if the clients socket closes they are removed from the channel we just placed them in.
    function remove () {
      removeSubscriber(id, client);
      sendMessageToRoute(id, new api.ClientExit(client.getClientId(), id));
    }
    // no funny stuff or you're gone.
    client.getStream().on("close", remove);
    client.getStream().on("end",   remove);
    client.getStream().on("error", remove);

    return true;
  }

  function addSubscriber (resource, client) {
    if (routes[resource]) {
      routes[resource].addSubscriber(client);
      return true
    } else {
      routes[resource] = new Route(resource);
      return addSubscriber(resource, client);
    }
  };

  function removeSubscriber (resource, client) {
    console.log("Removing subscriber from " + resource);
    routes[resource].removeSubscriber(client);
  };


  ////////////////////////////////////////////////////////////////////////

  function sendMessageToRoute(resource, mesg) {
    if (routes[resource]) {
      routes[resource].send(mesg);
      return true;
    } else {
      return false;
    }
  };
  

}
exports.Application = Application;
