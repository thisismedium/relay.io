var api   = require("relay-core/api");

function Client (client_id, stream) {
  this.getClientId = function getClientId() {
    return client_id;
  };
  this.getStream = function getString () {
    return stream;
  };
  this.write = function write(data) {
    return stream.write(data);
  };
}

// Application ////////////////////////////////////////////////////////////

function Application (appId) {

  this.getAppId = function () { 
    return appId 
  };

  // Application.assumeStream - give an application control over a socket
  this.assumeStream = function(stream) {
    streamHandler(stream);
  };

  ////////////////////////////////////////////////////////////////////////

  // The applications id 
  appId = appId;

  // The routes of this application can be either @users or #channels
  // subchannels look like #channels/#subchannel
  // this is a flat list of key/value mappings
  // all application have a #global channel.  The global channel acts
  // as a control channel for the entire application.

  routes = { "#global": [] };

  current_client_id = 0;

  function newClientId () {
    return ("client-" + appId + "-" + current_client_id++);
  }

  ////////////////////////////////////////////////////////////////////////

  function streamHandler (app_stream) {
    var client = new Client(newClientId(), app_stream);

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
  
  ////////////////////////////////////////////////////////////////////////

  function processRequest(request, client) {
    var calls = { 
      
      // When client says ____  do  ____.

      // Client said "Hello", they are brand new to the world...

      "Hello" : function () {
        
        // Inform the client about their client_id.
        client.write(new api.HelloResponse(client.getClientId()))

        // Join the users private channel.
        joinRoute("@"+client.getClientId(), client);

        // Join the global control channel.
        joinRoute("#global", client);

        // Inform the global channel of the clients activation.
        sendToRoute("#global", new api.MessageRequest("#global","@master","User @" + client.getClientId() + " has entered #global"));

      },

      // Client said "Join", the client wants to join a channel to listen for updates

      "Join" : function () {
        if (joinRoute(request.getBody(), client)) {
          // If the client is able to choin the channel (aka route) then inform everyone on that channel that they have entered.
          sendToRoute(request.getBody(), new api.MessageRequest(request.getBody(), "@master","User @" + client.getClientId() + " has entered channel " + request.getBody()));

          // Inform the client of a successful "Join".
          client.write(new api.JoinResponse());
        }
      },

      // The client as sent us a "Message", we need to route it to the right users.
      "Message" : function () {

        // The client could be pulling a fast one so we simply discard the "from" field from the messages and set it to whatever
        // user we tagged in incoming stream with.
        request.setFrom("@"+client.getClientId())

        process.nextTick (function () {

          // Send the message to the proper channels.
          sendToRoute(request.getTo(), request);

          // Inform the client that their message has been delivered.
          client.write(new api.MessageResponse());

        });

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
      sendToRoute(id, new api.MessageRequest(id, "@master","User @" + client.getClientId() + " has left the channel " + id));
    }
    // no funny stuff or you're gone.
    client.getStream().on("close", remove);
    client.getStream().on("end",   remove);
    client.getStream().on("error", remove);

    return true;
  }

  function addSubscriber (resource, client) {
    if (routes[resource]) {
      routes[resource].push(client);
      return true
    } else {
      routes[resource] = []
      return addSubscriber(resource, client);
    }
  };

  function removeSubscriber (resource, client) {
    console.log("Removing subscriber from " + resource);
    var out = [];
    var res = routes[resource];
    console.log(res.length);
    for (var i = 0; i < res.length; i++) {
      if (res[i].getClientId() != client.getClientId()) out.push(res[i]);
    }
    routes[resource] = out;
    console.log(out.length);
  };


  ////////////////////////////////////////////////////////////////////////

  function sendToRoute(resource, mesg) {
    var from = mesg.getFrom();
    if (routes[resource]) {
      routes[resource].forEach(function(subscriber) {
        console.log("Sending message to client: " + subscriber.getClientId())
        if (subscriber.getClientId() != from) {
          subscriber.write(mesg);
        }
      });
      return true;
    } else {
      return false;
    }
  };
  

}
exports.Application = Application;
