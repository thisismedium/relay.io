var api   = require("relay-core/api");

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
    var client_id = newClientId();
    app_stream.removeAllListeners("data");
    app_stream.on("data", function (data) {
      processRequest (data, client_id, app_stream);
    });
    app_stream.on("close", function () {
      app_stream.destroy();
    });
    app_stream.on("end", function () {
      app_stream.destroy();
    });
  };
  
  ////////////////////////////////////////////////////////////////////////

  function processRequest(request, client_id, sender) {
    var calls = { 
      "Hello" : function () {
        sender.write(new api.HelloResponse(client_id))
        joinRoute("@"+client_id, sender);
        joinRoute("#global", sender);
        sendToResource("#global", new api.MessageRequest("#global","@master","User @" + client_id + " has entered #global"));
      },
      "Join" : function () {
        sendToResource(request.getBody(), new api.MessageRequest(request.getBody(), "@master","User @" + client_id + " has entered channel " + request.getBody()));
        joinRoute(request.getBody(), sender);
        sender.on("close", function () {
          removeSubscriber(request.getBody(), client_id, sender);
          sendToResource(resource, new api.MessageRequest(resource, "@master","User @" + client_id + " has left the channel " + request.getBody()));
        });
        sender.write(new api.JoinResponse());
      },
      "Message" : function () {
        request.setFrom("@"+client_id)
        sendToResource(request.getTo(), request)
        sender.write(new api.MessageResponse());
      }
    }
    console.log(request.dump());
    calls[request.getType()]();
  };

  ////////////////////////////////////////////////////////////////////////

  function joinRoute (id, sender) {
    addSubscriber (id, sender);
  }

  function addSubscriber (resource, subscriber) {
    if (routes[resource]) {
      routes[resource].push(subscriber);
      return true
    } else {
      routes[resource] = []
      return addSubscriber(resource, subscriber);
    }
  };

  function removeSubscriber (resource, subscriber) {
    console.log("Removing subscriber");
    var out = [];
    var res = routes[resource];
    console.log(res.length);
    for (var i = 0; i < res.length; i++) {
      if (res[i] != subscriber) out.push(res[i]);
    }
    routes[resource] = out;
    console.log(out.length);
  };


  ////////////////////////////////////////////////////////////////////////

  function sendToResource(resource, mesg) {
    if (routes[resource]) {
      routes[resource].forEach(function(subscriber) {
        subscriber.write(mesg);
      });
      return true;
    } else {
      return false;
    }
  };
  

}
exports.Application = Application;
