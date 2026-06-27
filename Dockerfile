FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libatomic1

COPY package*.json ./
RUN npm install --ignore-engines

COPY . .

CMD ["node", "index.js"]
