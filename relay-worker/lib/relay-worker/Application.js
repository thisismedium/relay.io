function Application (appId) {
  appId = appId;
  subscribers = {};

  this.addSubscriber = function (resource, subscriber) {
    if (subscribers[resource]) {
      subscribers[resource].push(subscriber);
      return true
    } else {
      subscribers[resource] = []
      return this.addSubscriber(resource, subscriber);
    }
  };

  this.getAppId = function () { return appId };

  this.sendToResource = function (resource, mesg) {
    if (subscribers[resource]) {
      subscribers[resource].forEach(function(subscriber) {
        subscriber.send(mesg);
      });
      return true;
    } else {
      return false;
    }
  };

  this.processRequest = function (request, sender) {
    var calls = { 
      "Hello" : function () {
        sender.send(new api.HelloResp(this.newClientId()))
      },
      "Join" : function () {
        this.addSubscriber (request.getBody(), sender);
        sender.send(api.MessageResp());
      },
      "Message" : function () {
        this.sendToResource(request.getTo(), request)
      }
    }
    calls[request.getType()]();
  };
}

exports.Application = Application;
