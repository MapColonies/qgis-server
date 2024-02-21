FROM openquake/qgis-server:3.16.13

RUN chgrp -R 0 /tmp /var/cache /var/log/nginx /var/lib/nginx /var/lib/qgis
RUN chmod -R g=u /tmp /var/cache /var/log/nginx /var/lib/nginx /var/lib/qgis

# Uncomment while developing to make sure the docker runs on openshift
# RUN useradd -ms /bin/bash user && usermod -a -G root user
# USER user

ENTRYPOINT /usr/local/bin/start-xvfb-nginx.sh