NAME=mediasoup-broadcast-example
CONTEXT=${CONTEXT-ts}
case "$1" in
upgrade | "")
  helm upgrade --recreate-pods --install $NAME -f charts/$CONTEXT.yaml \
    charts/$NAME --kube-context=$CONTEXT
  ;;
status)
  helm status $NAME --kube-context=$CONTEXT
  ;;
*)
  echo "Need {upgrade|status}" 1>&2
  ;;
esac
