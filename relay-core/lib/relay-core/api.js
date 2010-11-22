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
             | Error "Invalid Keys"

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

function autoMessage (fn) {
  return autoRecord(function () {
    this.replyWith = function (replyMesg) {
      if (this.getMesgId) replyMesg._data_.mesgId = this.getMesgId();
      return replyMesg;
    };
    this.sendTo = function (socket) {
      return socket.write(this);
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

  exports.Error = autoMessage(function (error_code, error_message) {
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

  // Hello - Initialize a connection

  exports.Hello = autoMessage (function(app_id, keys) {
    this.load({
      "type": "Hello",
      "body": app_id,
      "keys": keys
    });
    this.getKeys = function () {
      if (this._data_.keys) {
        return this._data_.keys;
      } else {
        return undefined;
      }
    }
  });
  
  exports.Welcome = autoMessage (function (client_id) {
    this.load({
      "status": ST_SUCCESS,
      "type": "Welcome",
      "body": client_id
    });

    this.getClientId = function () {
      return this.getBody();
    }
    
  });

  // Join - Listen for messages

  exports.Join = autoMessage (function (address, keys) {
    this.load({
      "type": "Join",
      "body": address,
      "keys": keys
    });
  });

  exports.Enter = autoMessage (function () {
    this.load({
      "type": "Enter",
      "status": ST_SUCCESS
    });
  });

  // Leave - Leave a channel

  exports.Leave = autoMessage (function(address) {
    this.load({ "type":"Leave", "body":address });  
  });

  exports.Left = autoMessage (function() {
    this.load({ "type":"Left"});  
  });

  exports.ClientEnter = autoMessage(function(client_id, channel) {
    this.load({ "type": "ClientEnter", 
                "body": { "clientId": client_id,
                          "channelId": channel }
              });
  });

  exports.ClientExit = autoMessage(function(client_id, channel) {
    this.load({ "type": "ClientExit", 
                "body": { "clientId": client_id,
                          "channelId": channel }
              });
  });

  exports.List = autoMessage(function(channel) {
    this.load({"type": "List",
               "body": channel});
    this.getChannelId = function () {
      return this.getBody();
    }
  });
  
  exports.ChannelInfo = autoMessage(function(channel, clients) {
    this.load({"type": "ChannelInfo",
               "channel": channel,
               "clients": clients});
  });

  // Message - a message

  exports.Message = autoMessage (function (to, from, body) {
    this.load({
      "type": "Message",
      "to": to,
      "from": from,
      "body": body
    });
  });

  exports.MessageAccepted = autoMessage(function() {
    this.load({"type": "MessageAccepted"});
  });

  // InvalidMessage

  exports.InvalidMessage = autoMessage(function(mesg) {
    this.load({"type": "InvalidMessage", "message": mesg });
    this.getMesgId = function () {
      return mesg.mesgId;
    }
  });

  // convert raw json data into a fancier Javascript function with accessor
  // methods and what not.


  var mesg_constructors = {

    "Hello"  : exports.Hello,
    "Welcome": exports.Welcome,

    "Join"   : exports.Join,
    "Enter"  : exports.Enter,

    "ClientEnter": exports.ClientEnter,
    "ClientExit": exports.ClientExit,

    "List": exports.List,
    "ChannelInfo": exports.ChannelInfo,

    "Leave"  : exports.Leave,
    "Left"   : exports.Left,

    "Message": exports.Message,
    "MessageAccepted": exports.MessageAccepted,

    "Error"  : exports.Error

  }

  exports.constructMessage = function (data) {
    var cons = mesg_constructors[data.type];
    if (!cons) 
      return (new exports.InvalidMessage(data));
    else
      return (new cons()).load(data)
  };
})(exports)
