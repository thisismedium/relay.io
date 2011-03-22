function Perms () {}
Perms.read  = 1;
Perms.write = 2;

Perms.canRead = function (perm) {
  return perm & Perm.read;
};
Perms.canWrite = function (perm) {
  return perm & Perm.write
}

function com (f1, f2) { 
  return function () {
    return f1(f2.apply(this, arguments)) 
  }
};

Perms.makePermFromString = function (str, orig) {
  return Perms.makeMaskFromString(str)(orig);
};

Perms.makeMaskFromString = function (str) {
  var perms = { "r" : Perm.read, "w" : Perm.write }
  var mods  = { "+" : function (v) { return function (x) { return x | v } }, 
                "-": function (v) { return function (x) { return x & ~v; }}
              }
  var p = str.split("");
  var mod;
  if (!p[0] || !(p[0] in mods)) {
    mod = mods["+"];
    var fn = function (x) { return 0 };
  } else {
    var fn = function (x) { return x }
  }
  for (var i = 0; i < p.length; i++) {
    if (p[i] in mods) {
      mod = mods[p[i]];
    } else {
      fn = com(mod(perms[p[i]]), fn) 
    }
  }
  return fn;
};

module.exports = Perms;
