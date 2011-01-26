var api                   = require("relay-core/api");
var groupChannelsBySocket = require("relay-core/multiplex").groupChannelsBySocket;
var Key                   = require("./Key").Key;
var it                    = require("iterators");
// Client ///////////////////////////////////
  
/* 
   a Client is a user of the application, when a client initializes a
   session it is given a client-id...
*/
  
function Client (client_id, stream) {

  var perms = 0;
  var roles = {};

  this.addRole = function (role) {
    roles[role.key] = role;
    perms = role.mask | perms;
  };

  this.__defineGetter__("roles", function () { return roles });
  this.__defineGetter__("mask", function () { return perms });

  this.canWrite = function canWrite () {
    return api.PERM_WRITE & perms
  };

  this.canRead = function canRead () {
    return api.PERM_READ & perms
  };

  this.canCreate = function () {
    return api.PERM_CREATE_CHAN & perms;
  };

  this.getClientId = function getClientId() {
    return client_id;
  };

  ////////////

  this.getStream = function getStream () {
    return stream;
  };

  this.getSocket = function getSocket () {
    return stream.getSocket();
  };

  this.send = function (data) {
    return stream.send(data);
  };

}
Client.prototype.toString = function () { return "<Client>" }
// Route ///////////////

// A Route is a collection of one or more clients.

function Route (name, mask, acl) {
  var self = this;
  if (typeof(mask) === "undefined") mask = api.PERM_READ | api.PERM_WRITE;
  var subscribers = [];

  this.getName = function getName () {
    return name;
  }

  this.__defineSetter__("mask", function (m) { mask = m });
  this.__defineSetter__("acl",  function (a) { acl = acl });
  this.__defineGetter__("address", function () { return name });

  this.mergeClientMask = function (client) {
    var cmask = mask;
    if (acl) {
      it.each(client.roles, function (role) {
        var ar = acl.getRoleByKey(role[1].key)
        if (ar) {
          cmask = ar.mask | cmask;
        }
      });
    } else {
      cmask = client.mask | cmask;
    }
    return cmask
  };
  
  this.canClientSubscribe = function (client) {
    var cmask = this.mergeClientMask(client);
    return api.PERM_READ & cmask;
  };

  this.addSubscriber = function addSubscriber (client) {
    for (var i = 0; i < subscribers.length; i++) {
      if (subscribers[i].getClientId() === client.getClientId()) {
        return false;
      }
    }
    subscribers.push(client);

    function remove () {
      self.removeSubscriber(client);
      self.send(new api.ClientExit(client.getClientId()));
    }

    client.getStream().on("close", remove);
    client.getStream().on("end",   remove);
    client.getStream().on("error", remove);

    return true;
  };

  this.listSubscribers = function listSubscribers () {
    return subscribers.map(function(subscriber) {
      return subscriber.getClientId();
    });
  };

  this.removeSubscriber = function removeSubscriber (client) {
    subscribers = it.filter(function (sub) {
      return (sub.getClientId() === client.getClientId())
    }, subscribers);
  };

  this.send = function send (mesg) {
    var streams = subscribers.map(function (s) { return s.getStream() });
    groupChannelsBySocket(streams).forEach(function(sub) {
      sub[0].multiWrite(sub, mesg);
    });
  }

};


// Application ////////////////////////////////////////////////////////////

function Application (data) {
  var self = this;
  this.load(data);

  var routes = {"#global": new Route("#global")};

  // Generate client IDs
  var current_client_id = 0;
  function newClientId () {
    return ("@client-" + self.getAddress() + "-" + (++current_client_id));
  }

  function maybeCreateRoute (address, mask, acl) {
    if (!getRouteByAddress(address)) {
      routes[address] = new Route(address, mask, acl);
      return routes[address];
    } else {
      return routes[address];
    }
  };

  function getRouteByAddress (address) {
    if (routes[address]) {
      return routes[address];
    } else {
      return null;
    }
  };

  // Handle incoming messages
  this.MessageHandler = function MessageHandler () {

    var client = null;

    this.initialize = function (stream) {
      // Every message handler is bound to a single client.
      client = new Client(newClientId(), stream, 0);
      stream.on("close", function () {
        stream.destroy();
      });
      stream.on("end", function () {
        stream.destroy();
      });
    };

    // Client said "Hello", they are brand new to the world...
    this.Hello = function (request, resp) {

      // If the request includes keys setup new permissions for the user.
      if (request.body.keys) {
        request.body.keys.forEach(function(key){
          var real_key = self.getRoleByKey(key);
          if (real_key) {
            client.addRole(real_key);
          }
        });
      }

      // Join the users private channel.
      maybeCreateRoute(client.getClientId()).addSubscriber(client);

      // Join the global control channel.
      var global = getRouteByAddress("#global");
      global.addSubscriber(client);

      // Inform the global channel of the clients activation.
      global.send(new api.ClientEnter(client.getClientId(), "#global"));

      // Inform the client about their client_id.
      resp.reply(new api.Welcome(client.getClientId()));
       
    }

    // Client said "Join", the client wants to join a channel to listen for updates

    this.Join = function (request, resp) {
      var addr = request.to;
      // Check that the client has read permissions and the 
      // requested route is a #channel (as opposed to a user)
      if (addr.match("^#[a-zA-Z1-9]*$")) {
        var staticChan = self.getChannelByAddress(addr);
        if (staticChan) {
          var route = maybeCreateRoute(addr, staticChan.mask, staticChan.acl);
        } else {
          if (client.canCreate()) {
            var route = maybeCreateRoute(addr);
          } else {
            resp.reply(new api.PermissionDeniedError());
          }
        }
        if (route) {
          if (!route.canClientSubscribe(client)) {
            resp.reply(new api.PermissionDeniedError());
          } else if (!route.addSubscriber(client)) {
            resp.reply(api.error(500, "Internal Error"));
          } else {
            // If the client is able to join the channel (aka route) 
            // then inform everyone on that channel that they have entered.
            route.send(new api.ClientEnter(client.getClientId(), addr));       
            // Inform the client of a successful "Join".
            resp.reply(new api.Okay());
          }
        }
      } else {
        resp.reply(new api.PermissionDeniedError());
      }
    }

    this.GetStatus = function (request, resp) {
      var route = getRouteByAddress(request.to);
      if (route) {
        resp.reply(new api.Status(route, route.listSubscribers()));
      } else {
        resp.reply(new api.PermissionDeniedError());
      }
    }

    // Client said "Leave" and wanted to leave a room.

    this.Leave = function (request, resp) {
      var route = getRouteByAddress(request.to);
      if (route) {
        route.removeSubscriber(client);
        route.send(new api.ClientExit(client.getClientId(), route.address));
        resp.reply(new api.Okay());
      } else {
        resp.reply(new api.PermissionDeniedError());
      }
    }

    // The client as sent us a "Message", we need to route it to the right users.
    this.Message = function (request, resp) {
      // Check that the client can write to the requested channel
      var route = getRouteByAddress(request.to);
      if (route) { // TODO Check clients write perms
        // The client could be pulling a fast one so we simply discard the "from" field 
        // from the messages and set it to whatever user we tagged in incoming stream with.
        request.from = client.getClientId();
        // Send the message to the proper channels.
        route.send(request);
        // Inform the client that their message has been delivered.
        resp.reply(new api.Okay());
      } else {
        client.send(new api.PermissionDeniedError());
      }
    }

    this.InvalidRequest = function (request, resp) {
      resp.reply(new api.InvalidRequestError());
    };

  };

}
Application.prototype = new api.Application()
exports.Application = Application;

