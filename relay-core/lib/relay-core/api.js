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
  var ST_PERMISSION_DENIED = 502  // Permission Denied

  exports.InvalidApplicationError = autoRecord (function () {
    this.load({ "type": "Error",
                "status": ST_INVALID_APP,
                "body": "Not a valid application"
              });
    });

  exports.PermissionDeniedError = autoRecord (function () {
    this.load({ "type": "Error",
                "status": ST_PERMISSION_DENIED,
                "body": "Permission Denied"
              });
    });

  // Hello - Initialize a connection

  exports.Hello = autoRecord (function(app_id, keys) {
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
  
  exports.Welcome = autoRecord (function (client_id) {
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

  exports.Join = autoRecord (function (address, keys) {
    this.load({
      "type": "Join",
      "body": address,
      "keys": keys
    });
  });

  exports.Enter = autoRecord (function () {
    this.load({
      "type": "Enter",
      "status": ST_SUCCESS
    });
  });

  // Leave - Leave a channel

  exports.Leave = autoRecord (function(address) {
    this.load({ "type":"Leave", "body":address });  
  });

  exports.Left = autoRecord (function() {
    this.load({ "type":"Left"});  
  });


  // Message - a message

  exports.Message = autoRecord (function (to, from, body) {
    this.load({
      "type": "Message",
      "to": to,
      "from": from,
      "body": body
    });
  });

  exports.MessageAccepted = autoRecord(function() {
    this.load({"type": "MessageAccepted"});
  })

  // exports.MessageResponse = autoRecord (function () {
  //   this.load({
  //     "type": "Message",
  //     "status": ST_SUCCESS
  //   });
  // });

  // convert raw json data into a fancier Javascript function with accessor
  // methods and what not.

  exports.Error = function () {
    this.load = function (json) {
      var error_constructors = {
        ST_INVALID_APP:       exports.InvalidApplicationError,
        ST_PERMISSION_DENIED: exports.PermissionDeniedError
      }
      var er = new (error_constructors[""+json.status])();
      er.load(json);
      this = er;
    };
  };
  exports.Error = autoRecord();

  var mesg_constructors = {

    "Hello"  : exports.Hello,
    "Welcome": exports.Welcome,

    "Join"   : exports.Join,
    "Enter"  : exports.Enter,

    "Leave"  : exports.Leave,
    "Left"   : exports.Left,

    "Message": exports.Message,
    "MessageAccepted": exports.MessageAccepted,

    "Error"  : exports.Error

  }

  exports.constructMessage = function (data) {
    var cons = mesg_constructors[data.type];
    if (!cons) 
      throw "Invalid response object '" + data.type + "'";
    else
      return (new cons()).load(data)
  };

  exports.addMesgId = function (to, from) {
    if (from.getMesgId) to._data_.mesgId = from.getMesgId();
    return to
  };

})(exports)
