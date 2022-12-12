FROM node

WORKDIR /usr/apps/chatty-server

COPY package*.json .
COPY . .

ENV NODE_ENV=production


RUN npm install



EXPOSE 2022

CMD [ "npm", "start" ]
