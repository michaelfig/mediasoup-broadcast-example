REGISTRY=${REGISTRY-registry.dev3.ts.liveblockauctions.com}
docker build -t $REGISTRY/mediasoup-broadcast-example .
docker push $REGISTRY/mediasoup-broadcast-example
