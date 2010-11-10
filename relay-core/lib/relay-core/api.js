var autoRecord = require("./autorecord").autoRecord;

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

  exports.HelloRequest = autoRecord (function(app_id) {
    this.load({
      "type": "Hello",
      "body": app_id
    })
  });
  
  exports.HelloResponse = autoRecord (function (client_id) {
    this.load({
      "status": ST_SUCCESS,
      "type": "Hello",
      "body": client_id
    });
  });

  // Join - Listen for messages

  exports.JoinRequest = autoRecord (function (address) {
    this.load({
      "type": "Join",
      "body": address
    });
  });

  exports.JoinResponse = autoRecord (function () {
    this.load({
      "type": "Join",
      "status": ST_SUCCESS
    });
  });

  // Message - a message

  exports.MessageRequest = autoRecord (function (to, from, body) {
    this.load({
      "type": "Message",
      "to": to,
      "from": from,
      "body": body
    });
  });

  exports.MessageResponse = exports.MessageRequest;

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

  exports.ErrorResponse = function () {
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
  exports.ErrorResponse = autoRecord();

  var resp_constructors = {
    "Hello"  : exports.HelloResponse,
    "Message": exports.MessageResponse,
    "MessageAccepted": exports.MessageAccepted,
    "Join"   : exports.JoinResponse,
    "Error"  : exports.ErrorResponse
  }

  exports.constructResponse = function (data) {
    var cons = resp_constructors[data.type];
    if (!cons) 
      throw "Invalid response object" ;
    else
      return (new cons()).load(data)
  };

})(exports)
