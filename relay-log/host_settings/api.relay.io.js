// Run a postgres server in your development environment. Use the
// `bin/setup.sh` script to create a user and database. Make sure the
// password you give to the setup script matches the password in the
// connection string below.
exports.database = 'pg://relay_io:a5ac331a-4128-11e0-89a2-001aa00a4e09@localhost:5432/relay_io';
exports.identity = 'archive@relay.io';
exports.port = 8160;
exports.host = 'localhost';