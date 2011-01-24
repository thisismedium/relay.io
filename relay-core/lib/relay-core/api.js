var it = require("iterators");
// The Relay API is defined below

(function (exports) {

  // Client type permission

  // Can read (on by default)
  exports.PERM_READ   = 1 << 0; 

  // Can write (send messages)
  exports.PERM_WRITE  = 1 << 1;

  // Can create channels and such
  exports.PERM_CREATE_CHAN = 1 << 2;

  // Can delete channels and such
  exports.PERM_DELETE_CHAN = 1 << 3;


  exports.PERM_ADMIN = exports.PERM_READ 
                     | exports.PERM_WRITE 
                     | exports.PERM_CREATE_CHAN 
                     | exports.PERM_DELETE_CHAN;

  var ST_SUCCESS = 200;
  var ST_ERROR   = 500;

  var ST_INVALID_APP       = 501; // Invalid application
  var ST_PERMISSION_DENIED = 502; // Permission Denied
  var ST_INVALID_REQUEST   = 503; // Invalid Request

  function message (type, to, from, body) {
    var mesg = {
      "type": type,  
      "body": body
    }
    if (to) mesg["to"] = to;
    return mesg;
  };
  exports.message = message;

  function error (code, message) {
    return message("Error", null, null, {"code": code, "message": message});
  }
  exports.error = error;

  // Errors...

  exports.invalidApplicationError = function () { 
    return error(ST_INVALID_APP, "Invalid Application");
  };

  exports.permissionDeniedError = function () {
    return error(ST_PERMISSION_DENIED, "Permission Denied");
  };

  exports.invalidRequestError = function () {
    return error(ST_INVALID_REQUEST, "Invalid Request");
  };

  
  ////////////////////////////////////////////////////////////////////////

  // General Success Message...

  exports.Okay = function () {
    return message("Okay");
  };

  // Hello - Initialize a connection
 
  exports.Hello = function (appId, keys) {
    return message("Hello", appId, null, {"keys": keys});
  }

  exports.Welcome = function (clientId) {
    return message("Welcome", clientId);
  }

  // Join - Listen for messages

  exports.Join = function (address, keys) {
    return message("Join", address, null, {"keys": keys});
  };

  exports.Leave = function (address) {
    return message ("Leave", address);
  };

  exports.GetStatus = function (channel) {
    return message ("GetStatus", channel);
  };

  exports.Status = function (channel, clients) {
    var mesg = message("Status", null, channel, {"clientList": clients});
    return message;
  };

  // Events...
    
  exports.ClientEnter = function (clientId, channel) {
    return message ("ClientEnter", null, channel, {"clientId": clientId});
  };

  exports.ClientExit = function (clientId, channel) {
    return message ("ClientExit", null, channel, {"clientId": clientId});
  };
  
  // Message...

  exports.Message = function (to, from, mesg) {
    return message("Message", to, from, mesg);
  };

  // Internal API...

  exports.RegisterStation = function (key) {
    return message("RegisterStation", null, null, {"key": key});
  };

  exports.GetApplicationData = function (appId) {
    return message("GetApplicationData", appId, null);
  };

  exports.ApplicationData = function (keys, channels) {
    return message("ApplicationData", null, null, {"keys": keys, "channels": channels});
  };

})(exports)
