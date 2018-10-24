FROM ubuntu:bionic
MAINTAINER Michael FIG <michael+coturn@fig.org>

# XXX: Workaround for https://github.com/docker/docker/issues/6345
RUN ln -s -f /bin/true /usr/bin/chfn

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
            coturn \
            curl \
            procps \
            --no-install-recommends

ADD turnserver.sh /turnserver.sh
ADD turnserver.conf.in /turnserver.conf.in

EXPOSE 443
CMD ["/bin/sh", "/turnserver.sh"]
