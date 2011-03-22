var api                   = require("relay-core/api");
var groupChannelsBySocket = require("relay-core/multiplex").groupChannelsBySocket;
var it                    = require("iterators");

var Application           = require("relay-core/types/Application");
var Client                = require("relay-core/types/Client");
var Route                 = require("relay-core/types/Route");

// Application ////////////////////////////////////////////////////////////

function RelayApplication (data) {
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
    var master = new Client(api.RELAY_MASTER_ADDRESS, null);

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
          if (!route.addSubscriber(client)) {
            resp.reply(new api.PermissionDeniedError());
          } else {
            // If the client is able to join the channel (aka route)
            // then inform everyone on that channel that they have entered.
            route.send(new api.ClientEnter(client.getClientId(), addr), master);
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
        route.send(new api.ClientExit(client.getClientId(), route.address), master);
        resp.reply(new api.Okay());
      } else {
        resp.reply(new api.PermissionDeniedError());
      }
    }

    // The client as sent us a "Message", we need to route it to the right users.
    this.Message = function (request, resp) {
      // Check that the client can write to the requested channel
      var route = getRouteByAddress(request.to);
      if (route) {
        // Send the message to the proper channels.
        if (route.send(request, client)) {
        // Inform the client that their message has been delivered.
          resp.reply(new api.Okay());
        } else {
          resp.reply(new api.PermissionDeniedError());
        }
      } else {
        resp.reply(new api.PermissionDeniedError());
      }
    }

    this.InvalidRequest = function (request, resp) {
      resp.reply(new api.InvalidRequestError());
    };

  };

}
Application.prototype = new Application();
exports.Application = Application;

