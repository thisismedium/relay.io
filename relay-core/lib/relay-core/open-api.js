if (typeof(window) != "undefined") {
  var __autoRecord = autoRecord;
} else {
  var bt = require("./better");
  var __autoRecord = bt.autoRecord;
}
var autoMesg = function (fn) { 
  fn.prototype.serialize = function ()  { 
    return this.dump();
  };
  fn.prototype.read      = function (x) { return this.load(x) };
  var nrec = __autoRecord(fn); 
  return nrec;
};
function prop(st) { return function () { return st } };
var makeRelayApi = function (api) {

    // relay.io API

    // This api defines the common language spoken accross all
    // relay.io components.  It is a work in progress.

    // The general idea is that you can use the containers below
    // to confirm data is in its proper state before using it.

    // all communication is made up of messages and containers that
    // hold messages.

    // There are three kinds of messages, Request, Responses and Errors
    // There are two kinds of contains, Request and Responses

    api.SUCCESS = 0;
    api.FAILURE = 1;

    // Response Messages

    api.FeedInfo = autoMesg(function (feedId, insertKey) {
      this.getType = prop("FeedInfo");
      this.load({ "feedId": feedId, 
                  "insertKey": insertKey });
      });

    api.CommandExitStatus = autoMesg(function ( succeed ) {
        this.getType = prop("CommandExitStatus");
        this.load({"exitStatus": (succeed) ? api.SUCCESS : api.FAILURE });
        this.isSuccess = function () { return succeed };
    });

    api.ValidKey = autoMesg(function() {
        this.getType = prop("ValidKey");
    });

    api.WorkerUri = autoMesg(function (uri) {
        this.getType = prop("WorkerUri");
        this.load({"workerUri": uri});
    });

    api.DataPacket = autoMesg(function (data) {
        this.getType = prop("DataPacket");
        this.load({"data": data});
        this.getData = function () {
          return this._data_.data;
        };
    });

    api.NullMessage = autoMesg(function () {
        this.getType = prop("NullMessage");
    });

    api.PongMessage = autoMesg(function () {
        this.getType = prop("PongMessage");
        this.load({"pong": true});
    });
    
    // Request Messages

    api.GetWorker = autoMesg(function (feedId) {
        this.getType = prop("GetWorker");
        this.load({"feedId":feedId});
    });

    api.ReportWorkerFailure = autoMesg(function(feedId) {
        this.getType = prop("ReportWorkerFailure");
        this.load({"feedId": feedId});
    });
    
    api.ValidateFeed = autoMesg(function(feedId, insertKey) {
        this.getType = prop("ValidateFeed");
        this.load({"feedId": feedId,
                   "insertKey": insertKey});
    });

    api.QuickPing = autoMesg(function () {
        this.getType = prop("QuickPing");

    });
    
    api.GetUpdate = autoMesg(function(feedId, offset, fastForward) {
        this.getType = prop("GetUpdate");
        this.load({"feedId": feedId,
                   "offset": offset,
                   "fastForward": fastForward});
        this.getFastForward = function () {
          if (this._data_.fastForward) { return true } else { return false }
        };
    });

    api.Insert = autoMesg(function(feedId, insertKey, insertData){
        this.getType = prop("Insert");
        this.load({"feedId": feedId,
                   "insertKey": insertKey,
                   "insertData": insertData});
        
        this.getInsertData = function () {
            return this._data_.insertData;
        };
    });

    // Error Messages

    var Error = autoMesg(function Error (name, message) {
        this.load({"type": name, "message": message, "name": name});
    });

    function makeCreateFeedError () {
        return new Error("createFeedError","Failed to create requested feed");
    };

    function makeFeedNotFoundError () {
        return new Error("feedNotFoundError","");
    };

    function makeNullError () {
        return new Error ("nullError","");
    };

    function makeBadRequestError () {
        return new Error ("badRequest","Malformed request.");
    };

    function makeInvalidKeyError () {
      return new Error ("invalidKey", "Not a valid insertKey");
    };

    function makeAccessDeniedError () {
      return new Error ("accessDenied", "No Access");
    };

    // Message Wrappers

    var Response = autoMesg(function Response(status, err, body, key) {

        this.load({"status": status, 
                   "error": err ? err.dump() : undefined, 
                   "type": (body) ? body.getType() : undefined,
                   "body": (body) ? body.dump() : undefined, 
                   "key": key});

        this.serialize = function () {
            return this.dump();
        };

        this.getBody = function () { return body };

        this.read = function (data) {
          if (api[data.type]) {
            var body = (new api[data.type]()).read(data.body);
            return (new Response(data.status, ((new Error()).load(data.error)), body, data.key));
          } else {
            console.log("Could not parse: " + typeof(data));
            console.log("Type was: " + data.type);
            return undefined;
          }
        };

        this.isSuccess = function () { return (this.getStatus() == api.SUCCESS); };
        this.isFailure = function () { return (status == api.FAILURE); };
    });

    success = function (packet,err) {
        return new Response (api.SUCCESS, err, packet);
    };

    failure = function (err) {
        return new Response (api.FAILURE, err, new api.NullMessage());
    };

    readResponse = function (data) {
        return (new Response).read(data);
    };

    var Request = autoMesg(function(request, key) {
      this.load({"body": (request) ? request.dump() : undefined,
                 "type": (request) ? request.getType() : undefined,
                 "key" : key});

      this.getBody = function () { return request };

        this.toJson = function () {
            return JSON.stringify(this.serialize());
        };

        this.read = function (data) {
          if (api[data.type]) {
            var body = (new api[data.type]()).read(data.body);
            return (new Request(body, data.key));
          } else {
            return undefined;
          }
        };

    });

    function makeRequest (request) { return (new Request(request)); }
    function readRequest (data) {
        return (new Request).read(data);
    };

    api.autoMesg = autoMesg;

    api.Error = Error;      

    api.Request     = Request;
    api.makeRequest = makeRequest;

    api.makeCreateFeedError   = makeCreateFeedError;
    api.makeFeedNotFoundError = makeFeedNotFoundError;
    api.makeBadRequestError   = makeBadRequestError;
    api.makeInvalidKeyError   = makeInvalidKeyError;
    api.makeAccessDeniedError = makeAccessDeniedError;

    api.success = success;
    api.failure = failure;

    api.readResponse = readResponse;
    api.readRequest  = readRequest;

    return api;

};


try {
  exports.makeRelayApi = makeRelayApi;
} catch(err) {
  window.relayIO = {};
  makeRelayApi(window.relayIO);
}

