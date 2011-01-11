var autoRecord = require("./utils/autorecord").autoRecord;

/*
  Messages are building blocks of a good conversation, the following is how 
  the client converses with the server.  Certain parts of the converstation 
  have different meanings based upon if the member is a server or client.

  Starting a session
  -------------------

  To start a session a client must great the server with the upmost politeness.  
  If the client wishes to do anything at all it must present keys.

  Client says: Hello <application> {I have} <[keys: key]>

  Server says: (Hello | Welcome) <client_id>
             | Error "Permission Denied"
             | Error "Invalid Key(s)"

  Joining a channel
  -----------------

  Client says: Join <channel> 

  Server says: (Join | Enter)
             | Error "Permission Denied"

  Recieving a Message
  -------------------
  
  Client says: (nothing after a Join)
  
  Server says: Message to: <client|channel> from: <client|channel> {with the} <message_body>

  Sending a Message
  -----------------

  Client says: Message to: <client|channel> from: <client> {with the} <message_body>

  Server says: MessageAccepted

*/


/*
  Status Codes: 

     2__: Success
     5__: Error

 */

// autoMessage wraps autoRecord and adds a few methods...

function $autoMessage (fn) {
  return autoRecord(function () {
    this.replyWith = function (replyMesg) {
      if (this.getMesgId) replyMesg._data_.mesgId = this.getMesgId();
      return replyMesg;
    };
    if (fn) fn.apply(this, arguments);
  });
}

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

  // Errors...

  exports.Error = $autoMessage(function (error_code, error_message) {
    this.load( { "type": "Error",
                 "status": error_code ? error_code : ST_ERROR,
                 "body"  : error_message ? error_message : "" });
  });

  exports.InvalidApplicationError = function () { 
    return new exports.Error(ST_INVALID_APP, "Invalid Application");
  };

  exports.PermissionDeniedError = function () {
    return new exports.Error(ST_PERMISSION_DENIED, "Permission Denied");
  };

  exports.InvalidRequestError = function () {
    return new exports.Error(ST_INVALID_REQUEST, "Invalid Request");
  };

  
  ////////////////////////////////////////////////////////////////////////

  // General Success Message...

  exports.Success = $autoMessage(function () {
    this.load({"type": "Success",
               "status": ST_SUCCESS});
  });

  // Hello - Initialize a connection

  exports.Hello = $autoMessage (function(app_id, keys) {
    this.load({
      "type": "Hello",
      "body": { 
        "keys": keys, 
        "appId": app_id 
      }
    });
    this.getKeys = function () {
      if (this._data_.body.keys) {
        return this._data_.body.keys;
      } else {
        return undefined;
      }
    }
  });
  
  exports.Welcome = $autoMessage (function (client_id) {
    this.load({
      "status": ST_SUCCESS,
      "type": "Welcome",
      "body": {
        "clientId": client_id
      }
    });
    this.getClientId = function () {
      return this.getBody().getClientId();
    }
    
  });

  // Join - Listen for messages

  exports.Join = $autoMessage (function (address, keys) {
    this.load({
      "type": "Join",
      "body": {
        "address": address,
        "keys": keys
      }
    });
    this.getAddress = function () { return this.getBody().getAddress() }
    this.getKeys    = function () { return this.getBody().getKeys() }
  });

  exports.Exit = $autoMessage (function(address) {
    this.load({
      "type":"Exit", 
      "body": {
        "address": address 
      }
    });  
    this.getAddress = function () { return this.getBody().getAddress() }
  });


  exports.ClientEnter = $autoMessage(function(client_id, channel) {
    this.load({ "type": "ClientEnter", 
                "body": { 
                  "clientId": client_id,
                  "channelId": channel }
              });
  });

  exports.ClientExit = $autoMessage(function(client_id, channel) {
    this.load({ 
      "type": "ClientExit", 
      "body": { 
        "clientId": client_id,
        "channelId": channel }
    });
  });

  exports.GetStatus = $autoMessage(function(channel) {
    this.load({
      "type": "GetStatus",
      "body": { 
        "address": channel
      }
    });
    this.getChannelId = function () {
      return this.getBody();
    }
  });
  
  exports.ResourceStatus = $autoMessage(function(channel, clients) {
    this.load({"type": "ResourceStatus",
               "body": {
                 "channelId": channel,
                 "clientsList": clients
               }
              });
  });

  // Message - a message

  exports.Message = $autoMessage (function (to, from, body) {
    this.load({
      "type": "Message",
      "to": to,
      "from": from,
      "body": body
    });
  });


  // InvalidMessage

  exports.InvalidMessage = $autoMessage(function (mesg) {
    this.load({"type": "InvalidMessage", "message": mesg });
    this.getMesgId = function () {
      return mesg.mesgId;
    }
  });


  // ApplicationData
  exports.ApplicationData = $autoMessage(function (keys) {
    this.load({"type": "ApplicationData", 
               "body": {
                 "keys": keys
               }
              });
  });

  exports.Key = $autoMessage(function (key, modes) {
    this.load({"type": "Key", "key": key, "mode": modes});
  });

  exports.RegisterStation = $autoMessage(function (key) {
    this.load({"type": "RegisterStation", "body": { "key": key }});
    this.getKey = function () { return this.getBody().getKey() }
  });

  // convert raw json data into a fancier Javascript function with accessor
  // methods and what not.


  var mesg_constructors = {

    "Success": exports.Success,

    "Hello"  : exports.Hello, // -> Welcome | Error
    "Welcome": exports.Welcome,

    "Join"   : exports.Join, // -> Success | Error

    "ClientEnter": exports.ClientEnter,
    "ClientExit": exports.ClientExit,

    "GetStatus": exports.GetStatus, // -> Status | Error
    "ResourceStatus": exports.ResourceStatus,

    "Exit"  : exports.Exit, // -> Success | Error

    "Message": exports.Message, // -> Success | Error

    "Error"  : exports.Error

  }

  exports.constructMessage = function (data) {
    var cons = mesg_constructors[data.type];
    if (!cons) 
      return (new exports.InvalidMessage(data));
    else
      return (new cons()).load(data)
  };

  exports.runRPC = function (envObj) {
    return function (data) {
      if (envObj["log"]) envObj["log"](data);
      if (envObj[data.getType()])
        envObj[data.getType()](data);
      else
        envObj["InvalidRequest"](request);
    };
  };

  exports.bindStreamToRpc = function (stream, env) {
    stream.removeAllListeners("data");
    if (envObj.initialize) { 
      envObj.initialize(stream);
    }
    stream.on("data", exports.runRPC(env));
  };

})(exports)
