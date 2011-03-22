var it = require("iterators");
// The Relay API is defined below

(function (exports) {

  exports.RELAY_MASTER_ADDRESS = "relayio";

  // Client type permission

  // Can read (on by default)
  exports.PERM_READ        = 1 << 0; 

  // Can write (send messages)
  exports.PERM_WRITE       = 1 << 1;

  // Can create channels and such
  exports.PERM_CREATE_CHAN = 1 << 2;

  // Can delete channels and such
  exports.PERM_MODIFY_CHAN = 1 << 3;


  exports.PERM_ADMIN = exports.PERM_READ 
                     | exports.PERM_WRITE 
                     | exports.PERM_CREATE_CHAN 
                     | exports.PERM_DELETE_CHAN;

  var ST_SUCCESS = 200;
  var ST_ERROR   = 500;

  var ST_INVALID_APP       = 501; // Invalid application
  var ST_PERMISSION_DENIED = 502; // Permission Denied
  var ST_INVALID_REQUEST   = 503; // Invalid Request

  // Message /////////////////

  ////////////////////////////////////////////////////////////////////////

  exports.isMessageInstance = function (x) { return (x instanceof Message) } 

  function message (type, to, from, body) {
    return new Message(type, to, from, body);
  };
  exports.message = message;

  function error (code, mesg) {
    return message("Error", null, null, {"code": code, "message": mesg});
  };
  exports.error = error;

  // Errors...

  exports.InvalidApplicationError = function () { 
    return error(ST_INVALID_APP, "Invalid Application");
  };

  exports.PermissionDeniedError = function () {
    return error(ST_PERMISSION_DENIED, "Permission Denied");
  };

  exports.InvalidRequestError = function () {
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
    return message("Status", null, null, {"address": channel, "clients": clients});
  };

  // Events...
    
  exports.ClientEnter = function (clientId, channel) {
    return message ("ClientEnter", channel, null, {"clientId": clientId});
  };

  exports.ClientExit = function (clientId, channel) {
    return message ("ClientExit", channel, null, {"clientId": clientId});
  };
  
  // Message...

  exports.Message = function (to, from, mesg) {
    return message("Message", to, from, mesg);
  };

  // Internal API...

  exports.RegisterStation = function (key) {
    return message("RegisterStation", null, null, {"key": key});
  };

  exports.GetApplication = function (appId) {
    return message("GetApplication", appId, null);
  };

  exports.CreateApplication = function () {
    return message("CreateApplication", null, null);
  };

  exports.ApplicationData = function (adata) {
    if (!(adata instanceof Application)) throw "Provided object is not Application Data";
    else return message("ApplicationData", null, null, adata.dump());
  };


  
  ////////////////////////////////////////////////////////////////////////
  // Used to inspect a message before it is passed
  // along to processes, this may be used 
  // to modify the message objects in some way 
  // such as adding getter/setters.
  ////////////////////////////////////////////////////////////////////////

  exports.inspectMessage = function (json) {
    var mesg = new Message();
    mesg.load(json);
    return mesg;
  };

})(exports)
