// Key ////
function Key (hash, perms) {
  this.getHash = function getHash () {
    return hash;
  }
  this.getPerms = function getPerms () {
    return perms
  }
};
exports.Key = Key;
