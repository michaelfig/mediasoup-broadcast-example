FROM node:carbon

WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install

# Bundle app source.
COPY . .

EXPOSE 8000
ENV PORT 8000
ENV HOST 0.0.0.0
CMD ["/usr/local/bin/node", "server/index.js"]
