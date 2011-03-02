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
  Message.prototype.__defineSetter__("to", function (s) { return this.message.to = s });
  Message.prototype.__defineGetter__("from", function () { return this.message.from });
  Message.prototype.__defineSetter__("from", function (address) { this.message.from = address });
  Message.prototype.__defineGetter__("body", function () { return this.message.body });

  Message.prototype.__defineGetter__("id", function () { return this.message.id });
  Message.prototype.__defineSetter__("id", function (i) { this.message.id = i; });

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


  function Application (data) {

    var self = this;
    if (!data)          var data      = {};
    if (!data.roles)    data.roles    = [];
    if (!data.channels) data.channels = [];
    if (!data.users)    data.users    = [];

    function ACL () {
      var self_self = this;
      var roles = [];
      this.addRole = function (key, mask) {
        if (!key || !mask) throw new Error("You must provide a key and mask");
        if (self.getRoleByKey(key)) {
          roles.push({"key": key, "mask": mask});
        } else {
          throw new Error("Invalid key provided.");
        }
      };
      this.getRoleByKey = function (key) {
        for (var i = 0; i < roles.length; i++) {
          if (roles[i].key === key) return roles[i];
        }
        return null;
      };
      this.dump = function () {
        return roles;
      };
      this.load = function (roles) {
        it.each(roles, function (r) {
          self_self.addRole(r.key, r.mask);
        });
        return this;
      };
    };

    function inspect (data) {
      if (!data)         throw new Error ("Application Data not provided");
      if (!data.name)    throw new Error ("Application does not have a name");
      if (!data.address) throw new Error ("Application does not have an address");
      return data;
    };

    this.load = function (json) {
      for (var key in json) {
        if (json.hasOwnProperty(key)) {
          if (key == "channels") {
            it.each(json[key], function (chan) {
              var acl = new ACL();
              acl.load(chan.acl);
              self.updateChannel(chan.address, acl, chan.mask);
            });
          } else {
            data[key] = json[key];
          }
        }
      }
      return this;
    }
    
    this.dump = function () {
      return inspect(data);
    };

    this.createACL = function () {
      return new ACL();
    };

    this.setName = function (n) { 
      data.name = n;       
      return this; 
    };
    this.setAddress = function (a) { 
      data.address = a 
      return this;
    };

    this.getAddress = function ()  { 
      if (!data.address) {
        throw new Error("no address");
      } else {
        return data.address 
      }
    }; 
    
    this.getName = function () {
      if (!data.name) {
        throw new Error("no name");
      } else {
        return data.name
      }
    }

    this.getRoleByKey = function (key) {
      for (var i = 0; i < data.roles.length; i++) {
        if (data.roles[i].key === key) return data.roles[i];
      }
      return null;
    };

    this.getChannelByAddress = function (address) {
      for (var i = 0; i < data.channels.length; i++) {
        if (data.channels[i].address == address) 
          return {
            "address" : data.channels[i].address,
            "acl"     : (new ACL()).load(data.channels[i].acl),
            "mask"    : data.channels[i].mask
          }
      }
      return null;
    };
    
    this.deleteRoleByKey = function (key) {
      data.roles = it.filter(function(x) { return x.key === key }, data.roles);
      return this;
    };
    
    this.deleteChannelByAddress = function (address) {
      data.channels = it.filter(function(x) { return x.address === address }, data.channels);
      return this;
    };

    this.updateRole = function (name, key, mask) {
      if (!name || !key || !mask) { 
        throw "You must provide a name, key and mask";
      } else {
        this.deleteRoleByKey(key);
        data.roles.push({
          "name" : name,
          "key"  : key,
          "mask" : mask
        });
      }
      return this;
    };

    this.updateChannel = function (address, acl, mask) {
      if (!address || !acl) 
        throw new Error("You must provide an address and ACL");
      if (!(acl instanceof ACL))
        throw new Error("Invalid ACL");
      this.deleteChannelByAddress(address);
      data.channels.push({
        "address" : address,
        "acl"     : acl.dump(),
        "mask"    : mask ? mask : 0
      });
      return this;
    };
    this.addUser = function(name, password, keys) {
      throw new Error("not implemented");
      return this;
    };  
  }
  exports.Application = Application;
  
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
