#!/bin/sh

die () {
    echo "$1"
    exit 1
}

which git  || die " - git is missing"
which node || die " - node is missing"
which npm  || die " - npm is missing" 

RELAY=`pwd`

cd `mktemp -d` 

git clone git://github.com/jamessanders/node-tokyocabinet.git &&
(cd node-tokyocabinet &&
npm install)

git clone git://github.com/jamessanders/node-static.git &&
(cd node-static && npm install)

(cd $RELAY/relay-core && npm install)
