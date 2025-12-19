FROM --platform=linux/amd64 node:18

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application
COPY . .

EXPOSE 3000

CMD ["node", "server.mjs"]
