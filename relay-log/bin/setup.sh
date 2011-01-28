#!/bin/sh

username='relay.io'
dbname='relay.io'
schema=`dirname $0`/../extra/schema.sql

echo "Creating user ${username}, enter the password when prompted."
createuser -U root -DRSW ${username}

echo "Creating database ${dbname}."
createdb -U root -E UTF8 -O ${username} ${dbname}

echo "Importing schema ${schema}."
psql -U ${username} ${dbname} < ${schema}

echo ""
echo "Note: make sure the connection string in host_settings/$USER.js is correct."
echo ""