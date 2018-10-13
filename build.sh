#! /bin/sh
set -e
NAME=mediasoup-broadcast-example
KUBE_CONTEXT=${KUBE_CONTEXT-ts}
thisdir=`dirname "$0"`
export KUBE_CONTEXT
case "$1" in
build)
  cd "$thisdir"
  REGISTRY=`sed -ne '/^ *repository:/{ s/^.* \([^/]*\).*$/\1/; p; q; }' charts/"$KUBE_CONTEXT".yaml`
  docker build -t $REGISTRY/mediasoup-broadcast-example .
  docker push $REGISTRY/mediasoup-broadcast-example
  ;;
upgrade|install)
  cd "$thisdir"
  cmd="$1"
  shift
  helm --kube-context="$KUBE_CONTEXT" upgrade \
    --recreate-pods --install $NAME -f charts/"$KUBE_CONTEXT".yaml \
    charts/$NAME ${1+"$@"}
  ;;
"")
  $SHELL $0 build
  $SHELL $0 upgrade
  ;;
*)
  cmd="$1"
  shift
  helm --kube-context="$KUBE_CONTEXT" "$cmd" $NAME ${1+"$@"}
esac
