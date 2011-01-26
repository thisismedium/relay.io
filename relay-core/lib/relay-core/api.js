var it = require("iterators");
// The Relay API is defined below

(function (exports) {

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

  function Message (type, to, from, body, id){
    this.message = this.build.apply(this, arguments);
  };

  Message.prototype.build = function (type, to, from, body, id) {
    return { 
      "type" : type,
      "to"   : to,
      "from" : from,
      "body" : body,
      "id"   : id
    }  
  }
  Message.prototype.dump = function () {
    for (var key in this.message) {
      if (this.message.hasOwnProperty(key)) {
        if(this.message[key] == null) delete this.message[key];
      }
    }
    return this.message;
  }
  Message.prototype.load = function (obj) {
    this.message = this.build(obj.type, obj.to, obj.from, obj.body, obj.id);
  };
  Message.prototype.__defineGetter__("type", function () { return this.message.type });
  Message.prototype.__defineGetter__("to", function () { return this.message.to });
  Message.prototype.__defineGetter__("from", function () { return this.message.from });
  Message.prototype.__defineSetter__("from", function (address) { this.message.from = address });
  Message.prototype.__defineGetter__("body", function () { return this.message.body });

  Message.prototype.__defineGetter__("id", function () { return this.message.id });
  Message.prototype.__defineSetter__("id", function (i) { this.message.id = i; });

  ////////////////////////////////////////////////////////////////////////

  exports.isMessageInstance = function (x) { return (x instanceof Message) }; 

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
    return message("Status", null, channel, {"clients": clients});
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

  exports.ApplicationData = function (adata) {
    if (!(adata instanceof ApplicationBuilder)) throw "Provided object is not ApplicationBuider Data";
    else return message("ApplicationData", null, null, adata.dump());
  };

  function ApplicationBuilder (data) {

    if (!data)          var data = {}
    if (!data.roles)    data.roles = [];
    if (!data.channels) data.channels = [];
    if (!data.users)    data.users = [];

    function inspect (data) {
      if (!data.name) throw "Application does not have a name";
      return data;
    };
    
    this.dump = function () {
      return inspect(data);
    };
    
    this.setName    = function (n) { data.name = n };
    this.setAddress = function (a) { data.address = a };

    this.getAddress = function ()  { 
      if (!data.address) {
        throw "no address";
      } else {
        return data.address 
      }
    }; 

    this.getRoleByKey = function (key) {
      for (var i = 0; i < data.roles.length; i++) {
        if (data.roles[i].key === key) return data.roles[i];
      }
      return null;
    };

    this.getChannelByAddress = function (address) {
      for (var i = 0; i < data.channels.length; i++) {
        if (data.channels[i].address = address) return data.channels[i];
      }
      return null;
    };
    
    this.deleteRoleByKey = function (key) {
      data.roles = it.filter(function(x) { return x.key === key }, data.roles);
    };
    
    this.deleteChannelByAddress = function (address) {
      data.channels = it.filter(function(x) { return x.address === address }, data.channels);
    };

    this.updateRole = function (name, key, mask) {
      if (!name || !key || !mask) { 
        throw "You must provide a name, key and mask";
      } else {
        this.deleteRoleByKey(key);
        console.log(data.roles);
        data.roles.push({
          "name" : name,
          "key"  : key,
          "mask" : mask
        });
      };
    }
    this.updateChannel = function (address, keys, mask) {
      if (!address || !mask || !keys) {
        throw "You must provide a name, keys and mask";
      } else {
        this.deleteChannelByAddress(address);
        data.channels.push({
            "address" : address,
            "keys"    : keys,
            "mask"    : mask
        });
      }
    };
    this.addUser = function(name, password, keys) {
      throw "not implemented";
    };  
  }
  exports.ApplicationBuilder = ApplicationBuilder;
  
  ////////////////////////////////////////////////////////////////////////
  // Used to inspect a message before it is passed
  // along to processes, this may be used 
  // to modify the message objects in some way 
  // such as adding getter/setters.
  ////////////////////////////////////////////////////////////////////////

  exports.inspectMessage = function (json) {
    console.log("Inspecting message");
    var mesg = new Message();
    mesg.load(json);
    return mesg;
  };

})(exports)
