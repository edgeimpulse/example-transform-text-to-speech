# syntax = docker/dockerfile:experimental
FROM ubuntu:20.04
WORKDIR /app

ARG DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt update && apt install -y curl wget git sox build-essential libsox-fmt-mp3

# Node.js
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs

RUN npm set audit false -g

# Edge Impulse CLI
RUN npm install edge-impulse-cli@1.15.1 -g

# npm dependencies
COPY package* ./
RUN npm ci

# build application
COPY . ./

ENTRYPOINT [ "node", "tts.js" ]
