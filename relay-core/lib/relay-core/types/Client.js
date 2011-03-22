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
  this.__defineGetter__("address", function () { return client_id });

  this.canWrite = function canWrite () {
    return api.PERM_WRITE & perms;
  };

  this.canRead = function canRead () {
    return api.PERM_READ & perms;
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
Client.prototype.toString = function () { return "<Client>" };
module.exports = Client;
