#! /bin/sh
set -e
thisdir=`dirname "$0"`
REGISTRY=${REGISTRY-michaelfig}
NAME=mediasoup-broadcast-example
VERSION=`sed -ne '/^ *"version":/{ s/^.* "version": *"\([^"]*\)".*/\1/; p; q; }' "$thisdir"/package.json`

# If KUBE_CONTEXT=example, use --kube-context=example and -fcharts/example.yaml
KUBE_CONTEXT=${KUBE_CONTEXT-example}
export KUBE_CONTEXT
case "$1" in
build)
  cd "$thisdir"
  docker build -t michaelfig/mediasoup-broadcast-example:latest .
  ;;

push)
  cmd="$1"
  shift
  for TAG in latest $VERSION ${1+"$@"}; do
    docker tag michaelfig/mediasoup-broadcast-example:latest $REGISTRY/mediasoup-broadcast-example:$TAG
    docker push $REGISTRY/mediasoup-broadcast-example:$TAG
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
