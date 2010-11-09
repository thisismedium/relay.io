var autoRecord = require("./autorecord").autoRecord;

/*
  Status Codes: 

     2__: Success
     5__: Error

 */

(function (exports) {

  var ST_SUCCESS = 200;
  var ST_ERROR   = 500;

  var ST_INVALID_APP = 501; // Invalid application

  exports.InvalidApplicationError = autoRecord (function () {
    this.load({ "type": "Error",
                "status": ST_INVALID_APP,
                "body": "Not a valid application"
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

  exports.MessageResponse = autoRecord (function () {
    this.load({
      "type": "Message",
      "status": ST_SUCCESS
    });
  });

  // convert raw json data into a fancier Javascript function with accessor
  // methods and what not.

  var req_constructors = {
    "Hello"  : exports.HelloRequest,
    "Message": exports.MessageRequest,
    "Join"   : exports.JoinRequest
  }

  exports.constructRequest = function (data) {
    var cons = req_constructors[data.type];
    if (!cons) 
      throw "Invalid request object" ;
    else
      return (new cons()).load(data)
  };

})(exports)
