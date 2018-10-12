CONTEXT=${CONTEXT-ts}
REGISTRY=`sed -ne '/^ *repository:/{ s/^.* \([^/]*\).*$/\1/; p; q; }' charts/${CONTEXT}.yaml`
docker build -t $REGISTRY/mediasoup-broadcast-example .
docker push $REGISTRY/mediasoup-broadcast-example
