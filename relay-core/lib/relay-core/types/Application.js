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
module.exports = Application;
