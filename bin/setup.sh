#!/usr/bin/env bash

here=`dirname $0`
base=`dirname $here`

cd $base

die() {
    echo "## Fail ##"
    echo $@
    echo ""
    exit 1
}

echo ""
echo "## Preparing Dependencies ##"
echo ""

(which node &> /dev/null) || die "Can't find 'node'."
(which postgres &> /dev/null) || die "Can't find 'postgres'."
(which tchmgr &> /dev/null) || die "Can't find 'tchmgr' (Tokyo Cabinet)."

git submodule update --init
(cd $base/deps/node-tokyocabinet && node-waf configure build) || die "Can't build node-tokyocabinet"

echo "## Adding Settings ##"
for name in relay-hub relay-log relay-station relay-carrier; do
    echo "  + ${name}"
    (cd $base/$name/host_settings && cp -n sanders.js ${USER}.js)
done

echo ""
echo "## Installing DefineJS ##"
echo ""

curl -s https://github.com/weaver/DefineJS/raw/master/bin/install.sh | sh
curl -so /tmp/renode https://github.com/weaver/renode/raw/master/renode
set -x
sudo mv /tmp/renode /usr/local/bin/renode
set +x

(which defjs &> /dev/null) || die "Can't find 'defjs'."
(which redef &> /dev/null) || die "Can't find 'redef'."
(which renode &> /dev/null) || die "Can't find 'renode'."

echo ""
echo "## Setup ##"
echo ""

echo "Ok, you're almost ready to go. Do some post-installation setup:"
echo ""
echo "  + Edit relay-hub/host_settings/$USER.js"
echo "  + Set the database location"
echo "  + Stop editing, create the database directory"
echo "  + Start PostgreSQL"
echo "  + Run ./relay-log/bin/setup.sh"
echo "  + Make sure the password in relay-log/host_settings/$USER.js matches what you chose."
echo ""
echo "When all that's done, take Relay for a spin:"
echo ""
echo "  + Start relay using ./bin/develop"
echo "  + Run the example webchat in another terminal: ./test/webchat/runme"
echo "  + Open http://localhost:8080/ in a browser."

