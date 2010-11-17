var api                   = require("relay-core/api");
var groupChannelsBySocket = require("relay-core/network").groupChannelsBySocket;
var Key                   = require("./Key").Key;

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
  this.write = function write (mesg) {
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
    console.log("WRITE: " + api.PERM_WRITE & perms);
    return api.PERM_WRITE & perms
  };
  this.canRead = function canRead () {
    return api.PERM_READ & perms
  };
  this.resetPerms = function resetPerms () {
    perms = 0;
  };
  this.setPerms = function setPerms (p) {
    console.log("Adding perms: " + p);
    perms = p | perms;
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
  this.write = function write(data) {
    return stream.write(data);
  };
  this.fork = function (stream) {
    var nc = new Client(client_id, stream, perms);
    return nc;
  }
}

// Application ////////////////////////////////////////////////////////////

function Application (appId, keys) {

  var self = this;

  if (keys == undefined) keys = [];

  this.getAppId = function () { 
    return appId 
  };


  ////////////////////////////////////////////////////////////////////////

  // The routes of this application can be either @users or #channels
  // subchannels look like #channels/#subchannel
  // this is a flat list of key/value mappings
  // all application have a #global channel.  The global channel acts
  // as a control channel for the entire application.

  routes = { "#global": new Route("#global") };

  current_client_id = 0;

  function newClientId () {
    return ("client-" + appId + "-" + current_client_id++);
  }

  ////////////////////////////////////////////////////////////////////////

  // Application.assumeStream - give an application control over a socket
  this.assumeStream = function assumeStream (app_stream, client) {

    if (!client) client = new Client(newClientId(), app_stream, 0);

    app_stream.removeAllListeners("data");
    app_stream.on("data", function (data) {
      processRequest (data, client);
    });

    app_stream.on("close", function () {
      app_stream.destroy();
    });

    app_stream.on("end", function () {
      app_stream.destroy();
    });

  };

  function getKeyByHash (hash) {
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].getHash() === hash) {
        return keys[i];
      }
    }
    return undefined;
  };
  
  ////////////////////////////////////////////////////////////////////////

  function processRequest(request, client) {
    var calls = { 
      
      // When client says ____  do  ____.

      // Client said "Hello", they are brand new to the world...

      "Hello" : function () {

        // If the request includes keys setup new permissions for the user.
        if (request.getKeys()) {
          request.getKeys().forEach(function(key){
            var real_key = getKeyByHash(key);
            if (real_key) {
              client.setPerms(real_key.getPerms());
            }
          });
        }

        // Inform the client about their client_id.
        client.write(new api.Welcome(client.getClientId()))

        // Join the users private channel.
        joinRoute("@"+client.getClientId(), client);

        // Join the global control channel.
        joinRoute("#global", client);

        // Inform the global channel of the clients activation.
        sendToRoute("#global", new api.Message("#global",
                                               "@master",
                                               "User @" + client.getClientId() + " has entered #global"));
        
      },

      // Client said "Join", the client wants to join a channel to listen for updates

      "Join" : function () {
        if (client.canRead() && joinRoute(request.getBody(), client)) {

          // If the client is able to join the channel (aka route) then inform everyone on that channel that they have entered.
          sendToRoute(request.getBody(), new api.Message(request.getBody(), "@master","User @" + client.getClientId() + " has entered channel " + request.getBody()));

          // Inform the client of a successful "Join".
          client.write(new api.Enter());

        } else {
          client.write(new api.PermissionDeniedError());
        }
      },

      // The client as sent us a "Message", we need to route it to the right users.
      "Message" : function () {

        if (client.canWrite()) {
          // The client could be pulling a fast one so we simply discard the "from" field from the messages and set it to whatever
          // user we tagged in incoming stream with.
          request.setFrom("@"+client.getClientId())

          process.nextTick (function () {
            // Send the message to the proper channels.
            sendToRoute(request.getTo(), request);

            // Inform the client that their message has been delivered.
            client.write(new api.MessageAccepted());
          });
        } else {
          client.write(new api.PermissionDeniedError());
        }
      }

    }
    calls[request.getType()]();
  };

  ////////////////////////////////////////////////////////////////////////

  function joinRoute (id, client) {
    addSubscriber (id, client);
    // Set listener so that if the clients socket closes they are removed from the channel we just placed them in.
    function remove () {
      removeSubscriber(id, client);
      sendToRoute(id, new api.Message(id, "@master","User @" + client.getClientId() + " has left the channel " + id));
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

  function sendToRoute(resource, mesg) {
    if (routes[resource]) {
      routes[resource].write(mesg);
      return true;
    } else {
      return false;
    }
  };
  

}
exports.Application = Application;
