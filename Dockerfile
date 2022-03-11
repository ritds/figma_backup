FROM node:16.13.2
WORKDIR /app
ARG VERSION="0.0.4"
ENV VERSION=$VERSION
ENV USER = ""
ENV PASSWORD = ""

RUN apt update && apt install -y --no-install-recommends \
    python3-pip gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
    fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils libgtk-3-dev wget \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install pyyaml
RUN curl -L https://github.com/ritds/figma_backup/archive/refs/tags/v${VERSION}.zip -o v${VERSION}.zip \
    && unzip v${VERSION}.zip && mv ./figma_backup-${VERSION} ./figma && rm -rf ./firma/config
WORKDIR /app/figma
RUN npm i
VOLUME /app/figma/store
VOLUME /app/figma/config
ENTRYPOINT ./manage.sh $USER $PASSWORD