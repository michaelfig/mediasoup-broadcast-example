#!/bin/sh
TLS_DIRECTORY=${TLS_DIRECTORY-/tls}
if [ ! -f "/external_ip" ]; then
  if [ -z "$EXTERNAL_IP" ]; then
      curl http://icanhazip.com 2>/dev/null > /external_ip
  else
      echo $EXTERNAL_IP > /external_ip
  fi
fi

qsecret=`echo "$AUTH_SECRET" | sed -e 's/\([\/\\]\)/\\\\\1/g'`
qrealm=`echo "$AUTH_REALM" | sed -e 's/\([\/\\]\)/\\\\\1/g'`
sed -e "s/@AUTH_SECRET@/$qsecret/g; s/@AUTH_REALM@/$qrealm/g" \
  /turnserver.conf.in > /turnserver.conf

if [ -f $TLS_DIRECTORY/tls.crt ]; then
  echo "cert=$TLS_DIRECTORY/tls.crt" >> /turnserver.conf
fi
if [ -f $TLS_DIRECTORY/tls.key ]; then
  echo "pkey=$TLS_DIRECTORY/tls.key" >> /turnserver.conf
fi

exec /usr/bin/turnserver -c /turnserver.conf --external-ip `cat /external_ip`
