// The Relay API is defined below
// it is based on the simple JSON-RPC (2.0) protocol.
// We shall used named parameters on all request.

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

  function request (method, params) {
    return {
      "method": method,
      "params": params
    }
  };
  exports.request = request;

  function response (result, error) {
    return { 
      "result": result,
      "error" : error ? error : null
    }
  }
  exports.response = response;
  
  function error (code, message) {
    return response(null, {"code": code, "message": message});
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

  exports.Success = function () {
    return response({"status": "ok"});
  };

  // Hello - Initialize a connection
 
  exports.Hello = function (keys, appId) {
    return request("Hello", { "keys": keys, "appId": appId });
  }

  exports.HelloResponse = function (clientId) {
    return response({"clientId": client_id});
  }

  // Join - Listen for messages

  exports.Join = function (address, keys) {
    return request("Join", {"address": address, "keys": keys});
  };

  exports.Leave = function (address) {
    return request ("Leave", {"address": address});
  };

  exports.GetStatus = function (channel) {
    return request ("GetStatus", {"address": channel});
  };

  exports.GetStatusResponse = function (channel, clients) {
    return response ({"address": channel, "clientList": clients});
  };

  // Events...

  exports.ClientEnter = function (clientId, channel) {
    return request ("ClientEnter", {"clientId": clientId, "channelId": channel});
  };

  exports.ClientExit = function (clientId, channel) {
    return request ("ClientExit", {"clientId": clientId, "channelId": channel});
  };
  
  // Message...

  exports.Message = function (to, from, mesg) {
    return request("Message", {"to": to, "from": from, "message": mesg});
  };

  // Internal API...

  exports.RegisterStation = function (key) {
    return request("RegisterStation", {"key": key});
  };

  exports.GetApplicationData = function (appId) {
    return request("GetApplicationData", {"appId": appId});
  };

  exports.GetApplicationDataResponse = function (keys, channels) {
    retunr response({"keys": keys, "channels": channels});
  };

})(exports)
