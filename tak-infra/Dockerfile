FROM eclipse-temurin:17-jammy
RUN apt update \
    && apt-get install -y cron emacs-nox net-tools vim certbot curl libxml2-utils unzip nodejs

ENV HOME=/opt/tak
WORKDIR $HOME

COPY ./ $HOME/
COPY ./conf/ /opt/tak-conf/

EXPOSE 8089
EXPOSE 8443
EXPOSE 8444
EXPOSE 8446

ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=24
ENV TAK_VERSION=takserver-docker-5.7-RELEASE-43

RUN if [ -f "./${TAK_VERSION}.zip" ]; then \
        echo "Using local ${TAK_VERSION}.zip"; \
    elif ls ./takserver-docker-*.zip 1> /dev/null 2>&1; then \
        cp ./takserver-docker-*.zip ./${TAK_VERSION}.zip; \
    else \
        wget -q "http://tak-server-releases.s3-website.us-gov-east-1.amazonaws.com/${TAK_VERSION}.zip"; \
    fi

RUN unzip -q "./${TAK_VERSION}.zip" \
    && rm -f "./${TAK_VERSION}.zip" \
    && rm -rf "./${TAK_VERSION}/docker" \
    && cp -a ./${TAK_VERSION}/tak/. ./ \
    && rm -rf "./${TAK_VERSION}"

RUN mkdir -p $NVM_DIR \
    && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default \
    && npm install --no-progress --loglevel error \
    && npm install -g npm@11 --no-progress --loglevel error

ENTRYPOINT ["/bin/bash", "-c", "/opt/tak/start"]
