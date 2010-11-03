
var autoRecord = require("./autorecord").autoRecord;

/*
  Status Codes: 

     2__: Success
     5__: Error

 */

(function (exports) {

  var ST_SUCCESS = 200;
  var ST_ERROR   = 500;

  // Hello - Initialize a connection

  exports.HelloReq = autoRecord (function(app_id) {
    this.load({
      "type": "Hello",
      "body": app_id
    })
  });
  
  exports.HelloResp = autoRecord (function (client_id) {
    this.load({
      "status": ST_SUCCESS,
      "type": "Hello",
      "body": client_id
    });
  });

  // Join - Listen for messages

  exports.JoinReq = autoRecord (function (address) {
    this.load({
      "type": "Join",
      "body": address
    });
  });

  exports.JoinResp = autoRecord (function () {
    this.load({
      "type": "Join",
      "status": ST_SUCCESS
    });
  });

  // Message - a message

  exports.MessageReq = autoRecord (function (to, from, body) {
    this.load({
      "type": "Message",
      "to": to,
      "from": from,
      "body": body
    });
  });

  exports.MessageResp = autoRecord (function () {
    this.load({
      "type": "Message",
      "status": ST_SUCCESS
    });
  });

})(exports)
