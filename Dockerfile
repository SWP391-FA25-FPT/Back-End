# Base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Hugging Face Spaces yêu cầu port 7860
EXPOSE 7860

# Start app
CMD ["node", "server.js"]
