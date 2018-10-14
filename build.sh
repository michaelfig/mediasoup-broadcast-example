#! /bin/sh
set -e
NAME=mediasoup-broadcast-example
# If KUBE_CONTEXT=example, use --kube-context=example and -fcharts/example.yaml
KUBE_CONTEXT=${KUBE_CONTEXT-example}
thisdir=`dirname "$0"`
export KUBE_CONTEXT
case "$1" in
build)
  cd "$thisdir"
  # Find the name of the Docker registry from charts/$KUBE_CONTEXT.yaml's repository: line.
  REGISTRY=`sed -ne '/^ *repository:/{ s/^.* \([^/]*\).*$/\1/; p; q; }' charts/"$KUBE_CONTEXT".yaml`
  docker build -t $REGISTRY/mediasoup-broadcast-example .
  docker push $REGISTRY/mediasoup-broadcast-example
  ;;
upgrade|install)
  cd "$thisdir"
  cmd="$1"
  shift
  # Need --recreate-pods if hostNetworkIP is specified.
  # Otherwise, the old pod is never terminated for the new one to leave Pending.
  if grep -q '^ *hostNetworkIP:' charts/"$KUBE_CONTEXT".yaml; then
    RECREATE=--recreate-pods
  fi
  helm --kube-context="$KUBE_CONTEXT" upgrade \
    $RECREATE --install $NAME -f charts/"$KUBE_CONTEXT".yaml \
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
