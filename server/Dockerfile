FROM node:18-slim

WORKDIR /usr/src/app


COPY package*.json ./

# Install git and openssl (required for some npm packages and slim images)
RUN apt-get update && apt-get install -y git openssl

RUN npm install

COPY . .

EXPOSE 3000

CMD [ "node", "index.js" ]
