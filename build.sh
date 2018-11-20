#! /bin/sh
set -e
thisdir=`dirname "$0"`
REGISTRY=${REGISTRY-michaelfig}
NAME=mediasoup-broadcast-example
VERSION=`sed -ne '/^ *"version":/{ s/^.* "version": *"\([^"]*\)".*/\1/; p; q; }' "$thisdir"/package.json`
COTURNS_VERSION=4.5.0.7

# If KUBE_CONTEXT=example, use --kube-context=example and -fcharts/example.yaml
KUBE_CONTEXT=${KUBE_CONTEXT-`kubectl config current-context`}
export KUBE_CONTEXT
case "$1" in
build)
  cd "$thisdir"
  rm -rf _deps
  mkdir _deps
  for f in package*.json; do
    sed -e 's/^  "version": ".*",/  "version": "1.0.0",/' "$f" > _deps/"$f"
  done
  docker build -t michaelfig/mediasoup-broadcast-example:latest .
  ;;

build-coturns)
  cd "$thisdir"
  docker build -t michaelfig/coturns:latest coturns
  ;;

push)
  cmd="$1"
  shift
  for TAG in latest $VERSION ${1+"$@"}; do
    docker tag michaelfig/mediasoup-broadcast-example:latest $REGISTRY/mediasoup-broadcast-example:$TAG
    docker push $REGISTRY/mediasoup-broadcast-example:$TAG
  done
  ;;

push-coturns)
  cmd="$1"
  shift
  for TAG in latest $COTURNS_VERSION ${1+"$@"}; do
    docker tag michaelfig/coturns:latest $REGISTRY/coturns:$TAG
    docker push $REGISTRY/coturns:$TAG
  done
  ;;

upgrade|install)
  cd "$thisdir"
  cmd="$1"
  shift
  # Need --recreate-pods if hostNetworkIP is specified.
  # Otherwise, the old pod is never terminated for the new one to leave Pending.
  if grep -q '^ *hostNetworkIP:' charts/"$KUBE_CONTEXT".yaml; then
    RECREATE=${RECREATE---recreate-pods}
  fi
  helm --kube-context="$KUBE_CONTEXT" upgrade \
    $RECREATE --install $NAME -f charts/"$KUBE_CONTEXT".yaml --set=image.tag=$VERSION \
    charts/$NAME ${1+"$@"}
  ;;
"" | help)
  echo "Run: \`$0 upgrade' to helm upgrade using KUBE_CONTEXT=$KUBE_CONTEXT"
  ;;
*)
  cmd="$1"
  shift
  helm --kube-context="$KUBE_CONTEXT" "$cmd" $NAME ${1+"$@"}
esac
