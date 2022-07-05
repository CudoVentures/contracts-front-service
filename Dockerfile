FROM ubuntu:18.04

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl

# Update new packages
RUN apt-get update

# Install Node
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash

RUN apt-get install nodejs -y

# Service start

WORKDIR /service

COPY . .

RUN npm install

RUN npm install pm2 -g

CMD ["pm2-runtime", "src/server.js"]