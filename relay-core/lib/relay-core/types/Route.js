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
        var ar = acl.getRoleByKey(role[1].key);
        if (ar) {
          cmask = ar.mask | cmask;
        }
      });
    } else {
      cmask = client.mask | cmask;
    }
    return cmask;
  };

  this.canClientSubscribe = function (client) {
    if (client.address == api.RELAY_MASTER_ADDRESS) return 1;
    var cmask = this.mergeClientMask(client);
    return api.PERM_READ & cmask;
  };

  this.canClientWrite = function (client) {
    if (client.address == api.RELAY_MASTER_ADDRESS) return 1;
    var cmask = this.mergeClientMask(client);
    return api.PERM_WRITE & cmask;
  }

  this.addSubscriber = function (client) {
    if (this.canClientSubscribe(client)) {
      for (var i = 0; i < subscribers.length; i++) {
        if (subscribers[i].getClientId() === client.getClientId()) {
          return false;
        }
      }
      subscribers.push(client);

      function remove () {
        self.removeSubscriber(client);
        self.send(new api.ClientExit(client.getClientId(), self.address),
                  new Client(api.RELAY_MASTER_ADDRESS));
      };

      client.getStream().on("close", remove);
      client.getStream().on("end",   remove);
      client.getStream().on("error", remove);
      return true;
    } else {
      return false;
    }
  };

  this.listSubscribers = function listSubscribers () {
    return subscribers.map(function(subscriber) {
      return subscriber.getClientId();
    });
  };

  this.removeSubscriber = function (client) {
    subscribers = it.filter(function (sub) {
      return (sub.getClientId() === client.getClientId());
    }, subscribers);
  };

  this.send = function (mesg, from) {
    if (!(from instanceof Client)) {
      throw new Error("You must provide a message and client from which the message originated");
      return false;
    } else if (this.canClientWrite(from)) {
      mesg.from = from.address;
      var streams = subscribers.map(function (s) { return s.getStream() });
      groupChannelsBySocket(streams).forEach(function(sub) {
        sub[0].multiWrite(sub, mesg);
      });
      return true;
    } else {
      return false;
    }
  };
};

module.exports = Route;
