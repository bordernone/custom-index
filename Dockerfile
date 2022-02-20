FROM node:16.13-alpine3.15 AS REACT

COPY ui/package.json react/
COPY ui/package-lock.json react/

WORKDIR react/
RUN npm install

COPY ui .

RUN npm run-script build

FROM ubuntu:20.04 AS EXPRESS

RUN apt-get update
RUN apt-get -y install curl gnupg
RUN curl -sL https://deb.nodesource.com/setup_14.x  | bash -
RUN apt-get -y install nodejs
RUN apt-get install build-essential -y

COPY api/package.json app/

WORKDIR app/
RUN npm install

COPY api .

# Copy react build files
COPY --from=REACT /react/build /app/build

EXPOSE 3001

ENTRYPOINT ["node"]
CMD ["app.js"]