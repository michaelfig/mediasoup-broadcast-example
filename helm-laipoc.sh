RELEASE=mediasoup-broadcast-example
case "$1" in
upgrade)
  helm upgrade --recreate-pods --install $RELEASE -f charts/laipoc.yaml charts/mediasoup-broadcast-example --kube-context=laipoc
  ;;
status)
  helm status $RELEASE
  ;;
*)
  echo "Need {upgrade|status}" 1>&2
  ;;
esac
